import { controller, httpGet, interfaces, requestParam, httpDelete } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { Permissions } from '../helpers/Permissions'
import { StripeHelper } from "../helpers";
import { EncryptionHelper } from "@churchapps/apihelper";

@controller("/customers")
export class CustomerController extends GivingBaseController {

    @httpGet("/:id")
    public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const customer = await this.repositories.customer.convertToModel(au.churchId, await this.repositories.customer.load(au.churchId, id));
            if (!au.checkAccess(Permissions.donations.viewSummary) && au.personId !== customer.personId) return this.json({}, 401);
            else return customer;
        });
    }

    @httpGet("/:id/subscriptions")
    public async getSubscriptions(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            const permission = secretKey && (au.checkAccess(Permissions.donations.viewSummary) || (await this.repositories.customer.convertToModel(au.churchId, await this.repositories.customer.load(au.churchId, id)).personId === au.personId));
            if (!permission) return this.json({}, 401);
            else return await StripeHelper.getCustomerSubscriptions(secretKey, id);
        });
    }

    @httpGet("/")
    public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.viewSummary)) return this.json({}, 401);
            else return this.repositories.customer.convertAllToModel(au.churchId, await this.repositories.customer.loadAll(au.churchId));
        });
    }

    @httpDelete("/:id")
    public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.edit)) return this.json({}, 401);
            else await this.repositories.customer.delete(au.churchId, id);
        });
    }

    private loadPrivateKey = async (churchId: string) => {
        const gateways = await this.repositories.gateway.loadAll(churchId);
        return (gateways.length === 0) ? "" : EncryptionHelper.decrypt(gateways[0].privateKey);
    }

}
