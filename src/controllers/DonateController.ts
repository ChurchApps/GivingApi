import { controller, httpPost, interfaces } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { StripeHelper } from "../helpers/StripeHelper";

@controller("/donate")
export class DonateController extends GivingBaseController {

    @httpPost("/checkout")
    public async save(req: express.Request<{}, {}, { churchId: string, amount: number, successUrl: string, cancelUrl: string }>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapperAnon(req, res, async () => {
            const secretKey = await this.loadPrivateKey(req.body.churchId);
            if (secretKey === "") return this.json({}, 401);
            const sessionId = await StripeHelper.createCheckoutSession(secretKey, req.body.amount, req.body.successUrl, req.body.cancelUrl);
            return { "sessionId": sessionId };
        });
    }

    private loadPrivateKey = async (churchId: string) => {
        const gateways = await this.repositories.gateway.loadChurchProvider(churchId, "Stripe");
        console.log(JSON.stringify(gateways));
        const result = (gateways.length === 0) ? "" : gateways[0].privateKey;
        return result;
    }

}
