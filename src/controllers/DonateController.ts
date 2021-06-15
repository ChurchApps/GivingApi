import { controller, httpPost, interfaces } from "inversify-express-utils";
import express from "express";
import Stripe from "stripe";
import { GivingBaseController } from "./GivingBaseController"
import { StripeHelper } from "../helpers/StripeHelper";
import { EncryptionHelper } from "../apiBase/helpers";
import { Donation, FundDonation, Fund, DonationBatch, PaymentDetails, EventLog, Subscription, SubscriptionFund } from "../models";

@controller("/donate")
export class DonateController extends GivingBaseController {

    @httpPost("/log")
    public async log(req: express.Request<{}, {}, { donation: Donation, fundData: {id: string, amount: number} }>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapperAnon(req, res, async () => {
            const secretKey = await this.loadPrivateKey(req.body.donation.churchId);
            const { donation, fundData } = req.body;
            if (secretKey === "") return this.json({}, 401);
            this.logDonation(donation, fundData);
        });
    }

    @httpPost("/webhook/:provider")
    public async init(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
        return this.actionWrapperAnon(req, res, async () => {
            const churchId = req.query.churchId.toString();
            const gateways = await this.repositories.gateway.loadAll(churchId);
            if (!gateways.length) return this.json({}, 401);
            const gateway = gateways[0];
            const secretKey = EncryptionHelper.decrypt(gateway.privateKey);
            if (secretKey === "") return this.json({}, 401);
            const sig = req.headers["stripe-signature"].toString();
            const webhookKey = EncryptionHelper.decrypt(gateway.webhookKey);
            const stripeEvent: Stripe.Event = await StripeHelper.verifySignature(gateway.secretKey, req, sig, webhookKey);
            const eventData = stripeEvent.data.object as any; // https://github.com/stripe/stripe-node/issues/758
            const { created, customer, status, amount, description, metadata, subscription, failure_message, outcome, billing_reason } = eventData; // seller_message
            const subscriptionEvent = subscription || description.toLowerCase().includes('subscription');

            // Ignore subscription charge.succeeded events in place of invoice.paid for access to subscription data
            if (stripeEvent.type === 'charge.succeeded' && subscriptionEvent) return this.json({}, 200);

            let message = '';
            if (billing_reason) message = billing_reason + ' ' + status;
            else message = failure_message ? failure_message + ' ' + outcome.seller_message : outcome.seller_message;

            const methodTypes: any = { ach_debit: 'ACH Debit', card: 'Card' };
            const method = methodTypes[eventData.type];
            const methodDetails = method.last4;
            const donationDate = new Date(created * 1000); // Unix timestamp
            const customerData = await this.repositories.customer.load(churchId, customer);
            const donation: Donation = { amount, churchId, personId: customerData.personId, method, methodDetails, donationDate };

            const existingEvent = await this.repositories.eventLog.load(churchId, stripeEvent.id);
            if (!existingEvent) {
                const eventLog: EventLog = { id: stripeEvent.id, churchId, customerId: customer, provider: 'Stripe', eventType: stripeEvent.type, status, message, created: donationDate };
                await this.repositories.eventLog.create(eventLog)
            }

            if (stripeEvent.type === 'charge.succeeded' || stripeEvent.type === 'invoice.paid') {
                const funds = metadata.funds ? JSON.parse(metadata.funds) : await this.repositories.subscriptionFund.loadBySubscriptionId(churchId, subscription);
                this.logDonation(donation, funds);
            }
        });
    }

    @httpPost("/charge")
    public async charge(req: express.Request<any>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (secretKey === "") return this.json({}, 401);
            const donationData = req.body;
            const paymentData: PaymentDetails = { amount: donationData.amount, currency: 'usd', customer: donationData.customerId };
            const fundDonations: FundDonation[] = donationData.funds;
            if (donationData.type === 'card') {
                paymentData.payment_method = donationData.id;
                paymentData.confirm = true;
                paymentData.off_session = true;
            }
            if (donationData.type === 'bank') {
                paymentData.source = donationData.id;
                paymentData.metadata = { funds: JSON.stringify(fundDonations) };
            }
            return await StripeHelper.donate(secretKey, paymentData);
        });
    }

    @httpPost("/subscribe")
    public async subscribe(req: express.Request<any>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (secretKey === "") return this.json({}, 401);
            const donationData = req.body;
            const { id, amount, customerId, type, billing_cycle_anchor, proration_behavior, interval, } = donationData;
            const paymentData: PaymentDetails = { payment_method_id: id, amount, currency: 'usd', customer: customerId, type, billing_cycle_anchor, proration_behavior, interval,  };
            const funds: FundDonation[] = donationData.funds;
            const gateways = await this.repositories.gateway.loadAll(au.churchId);
            paymentData.productId = gateways[0].productId;
            const stripeSubscription = await StripeHelper.createSubscription(secretKey, paymentData);
            const subscription: Subscription = { id: stripeSubscription.id, churchId: au.churchId, personId: donationData.person.id, customerId: donationData.customerId };
            this.repositories.subscription.save(subscription);
            funds.forEach(fund => {
                const subscriptionFund: SubscriptionFund = { churchId: au.churchId, subscriptionId: subscription.id, fundId: fund.id, amount: fund.amount };
                this.repositories.subscriptionFund.save(subscriptionFund);
            });
        });
    }

    public logDonation = async (donationData: Donation, fundData: FundDonation) => {
        const batch: DonationBatch = await this.repositories.donationBatch.getOrCreateCurrent(donationData.churchId);
        donationData.batchId = batch.id;
        const donation = await this.repositories.donation.save(donationData);
        const fundDonation: FundDonation = { churchId: donation.churchId, amount: fundData.amount, donationId: donation.id, fundId: fundData.id };
        return this.repositories.fundDonation.save(fundDonation);
    }

    private loadPrivateKey = async (churchId: string) => {
        const gateways = await this.repositories.gateway.loadAll(churchId);
        return (gateways.length === 0) ? "" : EncryptionHelper.decrypt(gateways[0].privateKey);
    }

}
