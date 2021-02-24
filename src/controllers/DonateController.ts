import { controller, httpPost, interfaces } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { StripeHelper } from "../helpers/StripeHelper";
import { EncryptionHelper } from "../apiBase/helpers";
import { CheckoutDetails, Donation, FundDonation, Fund, DonationBatch } from "../models";

@controller("/donate")
export class DonateController extends GivingBaseController {

    @httpPost("/checkout")
    public async save(req: express.Request<{}, {}, CheckoutDetails>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapperAnon(req, res, async () => {
            const secretKey = await this.loadPrivateKey(req.body.churchId);
            if (secretKey === "") return this.json({}, 401);

            const details = req.body;
            const sessionId = await StripeHelper.createCheckoutSession(secretKey, req.body);
            return { "sessionId": sessionId };
        });
    }

    @httpPost("/log")
    public async log(req: express.Request<{}, {}, { churchId: string, sessionId: string }>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        console.log("MADE IT");
        return this.actionWrapperAnon(req, res, async () => {
            const secretKey = await this.loadPrivateKey(req.body.churchId);
            console.log(secretKey);
            if (secretKey === "") return this.json({}, 401);
            const details = await StripeHelper.verifySession(secretKey, req.body.sessionId);
            console.log(JSON.stringify(details));

            if (details.session !== null) {
                const existingDonation = await this.repositories.donation.loadByMethodDetails(req.body.churchId, "stripe", details.session.id);
                console.log("EXISTING");
                console.log(existingDonation);
                if (existingDonation === null) {
                    const generalFund: Fund = await this.repositories.fund.getOrCreateGeneral(req.body.churchId);
                    const batch: DonationBatch = await this.repositories.donationBatch.getOrCreateCurrent(req.body.churchId);
                    const notes = details.session.customer_email;
                    const donation: Donation = { amount: details.session.amount_total * 0.01, churchId: req.body.churchId, method: "stripe", methodDetails: details.session.id, donationDate: new Date(), batchId: batch.id, notes };
                    this.repositories.donation.save(donation);
                    const fundDonation: FundDonation = { churchId: donation.churchId, amount: donation.amount, donationId: donation.id, fundId: generalFund.id };
                    this.repositories.fundDonation.save(fundDonation);
                }
            }
        });
    }

    private loadPrivateKey = async (churchId: string) => {
        const gateways = await this.repositories.gateway.loadAll(churchId);
        const result = (gateways.length === 0) ? "" : EncryptionHelper.decrypt(gateways[0].privateKey);
        return result;
    }

}
