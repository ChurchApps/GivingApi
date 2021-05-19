import { controller, httpPost, interfaces } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { StripeHelper } from "../helpers/StripeHelper";
import { EncryptionHelper } from "../apiBase/helpers";
import { CheckoutDetails, Donation, FundDonation, Fund, DonationBatch, PaymentDetails } from "../models";

@controller("/donate")
export class DonateController extends GivingBaseController {

    // @httpPost("/checkout")
    // public async save(req: express.Request<{}, {}, CheckoutDetails>, res: express.Response): Promise<interfaces.IHttpActionResult> {
    //     return this.actionWrapperAnon(req, res, async () => {
    //         const secretKey = await this.loadPrivateKey(req.body.churchId);
    //         if (secretKey === "") return this.json({}, 401);

    //         const details = req.body;
    //         const sessionId = await StripeHelper.createCheckoutSession(secretKey, req.body);
    //         return { "sessionId": sessionId };
    //     });
    // }

    // @httpPost("/log")
    // public async log(req: express.Request<{}, {}, { churchId: string, sessionId: string }>, res: express.Response): Promise<interfaces.IHttpActionResult> {
    //     return this.actionWrapperAnon(req, res, async () => {
    //         let receiptUrl = "";
    //         const secretKey = await this.loadPrivateKey(req.body.churchId);
    //         if (secretKey === "") return this.json({}, 401);
    //         const details = await StripeHelper.verifySession(secretKey, req.body.sessionId);

    //         if (details.session !== null) {
    //             receiptUrl = details.receiptUrl;
    //             const existingDonation = await this.repositories.donation.loadByMethodDetails(req.body.churchId, "stripe", details.session.id);
    //             if (existingDonation === null) {
    //                 const generalFund: Fund = await this.repositories.fund.getOrCreateGeneral(req.body.churchId);
    //                 const batch: DonationBatch = await this.repositories.donationBatch.getOrCreateCurrent(req.body.churchId);
    //                 const notes = details.email + " " + details.name + " ";
    //                 const donation: Donation = { amount: details.session.amount_total * 0.01, churchId: req.body.churchId, method: "stripe", methodDetails: details.session.id, donationDate: new Date(), batchId: batch.id, notes };
    //                 this.repositories.donation.save(donation);
    //                 const fundDonation: FundDonation = { churchId: donation.churchId, amount: donation.amount, donationId: donation.id, fundId: generalFund.id };
    //                 this.repositories.fundDonation.save(fundDonation);
    //             }
    //         }
    //         return { receiptUrl };
    //     });
    // }

    @httpPost("/charge")
    public async charge(req: express.Request<any>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (secretKey === "") return this.json({}, 401);
            const donationData = req.body;
            const paymentData: PaymentDetails = { amount: donationData.amount, currency: 'usd', customer: donationData.customerId };
            if (donationData.type === 'card') {
                paymentData.payment_method = donationData.id;
                paymentData.confirm = true;
                paymentData.off_session = true;
            }
            if (donationData.type === 'bank') paymentData.source = donationData.id;
            const charge = await StripeHelper.donate(secretKey, paymentData);

            // Get fund from UI
            const generalFund: Fund = await this.repositories.fund.getOrCreateGeneral(req.body.churchId);

            const notes = donationData.person.email + " " + donationData.person.name + " ";
            const donation: Donation = { amount: charge.amount * 0.01, churchId: au.churchId, personId: donationData.person.id, method: "stripe", methodDetails: charge.id, donationDate: new Date(), notes };
            this.logDonation(donation, generalFund);
        });
    }

    @httpPost("/subscribe")
    public async subscribe(req: express.Request<any>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (secretKey === "") return this.json({}, 401);
            const donationData = req.body;
            const paymentData: PaymentDetails = { amount: donationData.amount, currency: 'usd', customer: donationData.customerId };
            // Get fund from UI
            const fund: Fund = donationData.fundId ? await this.repositories.fund.load(au.churchId, donationData.fundId) : await this.repositories.fund.getOrCreateGeneral(au.churchId);
            // if (!fund.productId) {
            //     const productId = await StripeHelper.createProduct(secretKey, fund);
            //     fund.productId = productId;
            //     await this.repositories.fund.update(fund);
            // }
            paymentData.default_payment_method = donationData.id;
            paymentData.productId = fund.productId;
            paymentData.interval = { interval: 'month', interval_count: 1 };
            const subscription = await StripeHelper.createSubscription(secretKey, paymentData);
            const notes = donationData.person.email + " " + donationData.person.name + " ";
            const donation: Donation = { amount: donationData.amount, churchId: au.churchId, personId: donationData.person.id, method: "stripe", methodDetails: subscription.id, donationDate: new Date(), notes };
            this.logDonation(donation, fund);
        });
    }

    public logDonation = async (donation: Donation, fund: Fund) => {
        const batch: DonationBatch = await this.repositories.donationBatch.getOrCreateCurrent(donation.churchId);
        donation.batchId = batch.id;
        this.repositories.donation.save(donation);
        const fundDonation: FundDonation = { churchId: donation.churchId, amount: donation.amount, donationId: donation.id, fundId: fund.id };
        this.repositories.fundDonation.save(fundDonation);
    }

    private loadPrivateKey = async (churchId: string) => {
        const gateways = await this.repositories.gateway.loadAll(churchId);
        const result = (gateways.length === 0) ? "" : EncryptionHelper.decrypt(gateways[0].privateKey);
        return result;
    }

}
