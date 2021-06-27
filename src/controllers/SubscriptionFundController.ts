import { controller, httpDelete, httpGet, interfaces, requestParam } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { Permissions } from '../helpers/Permissions'
import { StripeHelper } from "../helpers";
import { EncryptionHelper } from "../apiBase";

@controller("/subscriptionfunds")
export class SubscriptionFundController extends GivingBaseController {

    @httpGet("/:id")
    public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.viewSummary)) return this.json({}, 401);
            else return this.repositories.subscriptionFund.convertToModel(au.churchId, await this.repositories.subscriptionFund.load(au.churchId, id));
        });
    }

    @httpGet("/")
    public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.view)) return this.json({}, 401);
            else {
                if (req.query.subscriptionId !== undefined) return await this.repositories.subscriptionFund.loadBySubscriptionId(au.churchId, req.query.subscriptionId.toString());
                else return this.repositories.subscriptionFund.convertAllToModel(au.churchId, await this.repositories.subscriptionFund.loadAll(au.churchId));
            }
        });
    }

    @httpDelete("/:id")
    public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.edit)) return this.json({}, 401);
            else await this.repositories.subscriptionFund.delete(au.churchId, id);
        });
    }

    @httpDelete("/subscription/:id")
    public async deleteBySubscriptionId(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.edit)) return this.json({}, 401);
            else await this.repositories.subscriptionFund.deleteBySubscriptionId(au.churchId, id);
        });
    }


}
