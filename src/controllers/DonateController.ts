import { controller, httpPost, interfaces } from "inversify-express-utils";
import express from "express";
import Stripe from "stripe";
import { GivingBaseController } from "./GivingBaseController"
import { StripeHelper } from "../helpers/StripeHelper";
import { EncryptionHelper } from "../apiBase/helpers";
import { Donation, FundDonation, DonationBatch, PaymentDetails, EventLog, Subscription, SubscriptionFund } from "../models";
import { Environment } from "../helpers/Environment";
import Axios from "axios"

@controller("/donate")
export class DonateController extends GivingBaseController {

  @httpPost("/log")
  public async log(req: express.Request<{}, {}, { donation: Donation, fundData: { id: string, amount: number } }>, res: express.Response): Promise<interfaces.IHttpActionResult> {
    return this.actionWrapperAnon(req, res, async () => {
      const secretKey = await this.loadPrivateKey(req.body.donation.churchId);
      const { donation, fundData } = req.body;
      if (secretKey === "") return this.json({}, 401);
      this.logDonation(donation, [fundData]);
    });
  }

  @httpPost("/webhook/:provider")
  public async webhook(req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
    return this.actionWrapperAnon(req, res, async () => {
      const churchId = req.query.churchId.toString();
      const gateways = await this.repositories.gateway.loadAll(churchId);
      const secretKey = EncryptionHelper.decrypt(gateways[0].privateKey);
      if (!gateways.length || secretKey === "") return this.json({}, 401);

      const sig = req.headers["stripe-signature"].toString();
      const webhookKey = EncryptionHelper.decrypt(gateways[0].webhookKey);
      const stripeEvent: Stripe.Event = await StripeHelper.verifySignature(secretKey, req, sig, webhookKey);
      const eventData = stripeEvent.data.object as any; // https://github.com/stripe/stripe-node/issues/758
      const subscriptionEvent = eventData.subscription || eventData.description?.toLowerCase().includes('subscription');
      if (stripeEvent.type === 'charge.succeeded' && subscriptionEvent) return this.json({}, 200); // Ignore charge.succeeded from subscription events in place of invoice.paid for access to subscription id
      const existingEvent = await this.repositories.eventLog.load(churchId, stripeEvent.id);
      if (!existingEvent) await StripeHelper.logEvent(churchId, stripeEvent, eventData);
      if (stripeEvent.type === 'charge.succeeded' || stripeEvent.type === 'invoice.paid') await StripeHelper.logDonation(secretKey, churchId, eventData);
    });
  }

  @httpPost("/charge")
  public async charge(req: express.Request<any>, res: express.Response): Promise<interfaces.IHttpActionResult> {
    return this.actionWrapper(req, res, async (au) => {
      const donationData = req.body;
      const churchId = au.churchId || donationData.churchId;
      const secretKey = await this.loadPrivateKey(churchId);
      if (secretKey === "") return this.json({}, 401);

      const fundDonations: FundDonation[] = donationData.funds;
      const paymentData: PaymentDetails = { amount: donationData.amount, currency: 'usd', customer: donationData.customerId, metadata: { funds: JSON.stringify(fundDonations), notes: donationData.notes } };
      if (donationData.type === 'card') {
        paymentData.payment_method = donationData.id;
        paymentData.confirm = true;
        paymentData.off_session = true;
      }
      if (donationData.type === 'bank') paymentData.source = donationData.id;
      return await StripeHelper.donate(secretKey, paymentData);
    });
  }

  @httpPost("/subscribe")
  public async subscribe(req: express.Request<any>, res: express.Response): Promise<interfaces.IHttpActionResult> {
    return this.actionWrapper(req, res, async (au) => {
      const secretKey = await this.loadPrivateKey(au.churchId);
      if (secretKey === "") return this.json({}, 401);

      const { id, amount, customerId, type, billing_cycle_anchor, proration_behavior, interval, funds, person, notes } = req.body;
      const paymentData: PaymentDetails = { payment_method_id: id, amount, currency: 'usd', customer: customerId, type, billing_cycle_anchor, proration_behavior, interval, metadata: { notes } };
      const gateways = await this.repositories.gateway.loadAll(au.churchId);
      paymentData.productId = gateways[0].productId;

      const stripeSubscription = await StripeHelper.createSubscription(secretKey, paymentData);
      const subscription: Subscription = { id: stripeSubscription.id, churchId: au.churchId, personId: person.id, customerId };
      await this.repositories.subscription.save(subscription);

      const promises: Promise<SubscriptionFund>[] = [];
      funds.forEach((fund: FundDonation) => {
        const subscriptionFund: SubscriptionFund = { churchId: au.churchId, subscriptionId: subscription.id, fundId: fund.id, amount: fund.amount };
        promises.push(this.repositories.subscriptionFund.save(subscriptionFund));
      });
      await Promise.all(promises);
      return stripeSubscription;
    });
  }

  private logDonation = async (donationData: Donation, fundData: FundDonation[]) => {
    const batch: DonationBatch = await this.repositories.donationBatch.getOrCreateCurrent(donationData.churchId);
    donationData.batchId = batch.id;
    const donation = await this.repositories.donation.save(donationData);
    const promises: Promise<FundDonation>[] = [];
    fundData.forEach((fund: FundDonation) => {
      const fundDonation: FundDonation = { churchId: donation.churchId, amount: fund.amount, donationId: donation.id, fundId: fund.id };
      promises.push(this.repositories.fundDonation.save(fundDonation));
    });
    return await Promise.all(promises);
  }

  private loadPrivateKey = async (churchId: string) => {
    const gateways = await this.repositories.gateway.loadAll(churchId);
    return (gateways.length === 0) ? "" : EncryptionHelper.decrypt(gateways[0].privateKey);
  }

  @httpPost("/captcha-verify")
  public async captchaVerify(req: express.Request<{}, {}, { token: string }>, res: express.Response): Promise<interfaces.IHttpActionResult> {
    return this.actionWrapperAnon(req, res, async () => {
      try {
        // detecting if its a bot or a human
        const { token } = req.body;
        const response = await Axios.post(`https://www.google.com/recaptcha/api/siteverify?secret=${Environment.googleRecaptchaSecretKey}&response=${token}`);
        const data = response.data;

        if (!data.success) {
          return { response: "robot" };
        }

        // if google's response already includes b1.church in hostname property, no need to check in the DB then
        if (data.hostname.includes("b1.church")) {
          return { response: "human" }
        }

        // if its a custom domain, verify the domain exist in the DB
        const domainData = await Axios.get(`${Environment.membershipApi}/domains/public/lookup/${data.hostname.replace(".localhost", "")}`)
        const domain:any = await domainData.data;

        if (domain) {
          return { response: "human" }
        }

        // if calls is made from localhost
        if (data.hostname.includes(".localhost")) {
          return { response: "human" }
        }

        return { response: "" }
      } catch (error) {
        console.error(error)
        return this.json({ message: "Error verifying reCAPTCHA" }, 400);
      }
    })
  }

}
