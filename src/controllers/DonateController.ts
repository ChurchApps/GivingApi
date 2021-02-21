import { controller, httpPost, httpGet, interfaces, requestParam, httpDelete } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { Gateway } from "../models"
import { Permissions } from '../helpers/Permissions'
import { StripeHelper } from "../helpers/StripeHelper";

@controller("/donate")
export class DonateController extends GivingBaseController {

    @httpPost("/checkout")
    public async save(req: express.Request<{}, {}, { churchId: string, amount: number, successUrl: string, cancelUrl: string }>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapperAnon(req, res, async () => {
            const secretKey = "";
            return StripeHelper.createCheckoutSession(secretKey, req.body.amount, req.body.successUrl, req.body.cancelUrl);
        });
    }
}
