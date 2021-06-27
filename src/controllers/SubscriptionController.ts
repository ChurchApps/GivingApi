import { controller, httpDelete, httpGet, httpPost, interfaces, requestParam } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { Permissions } from '../helpers/Permissions'
import { StripeHelper } from "../helpers";
import { EncryptionHelper } from "../apiBase";

@controller("/subscriptions")
export class SubscriptionController extends GivingBaseController {

    @httpGet("/:id")
    public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.viewSummary)) return this.json({}, 401);
            else return this.repositories.customer.convertToModel(au.churchId, await this.repositories.customer.load(au.churchId, id));
        });
    }

    @httpGet("/:id/subscriptions")
    public async getSubscriptions(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.viewSummary)) return this.json({}, 401);
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (secretKey === "") return this.json({}, 401);
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

    @httpPost("/")
    public async save(req: express.Request<{}, {}, any[]>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.edit)) return this.json({}, 401);
            else {
                const promises: Promise<any>[] = [];
                const secretKey = await this.loadPrivateKey(au.churchId);
                req.body.forEach(subscription => { promises.push(StripeHelper.updateSubscription(secretKey, subscription)); });
                return await Promise.all(promises);
            }
        });
    }

    @httpDelete("/:id")
    public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.edit)) return this.json({}, 401);
            else {
                const secretKey = await this.loadPrivateKey(au.churchId);
                const promises: Promise<any>[] = [];
                promises.push(StripeHelper.deleteSubscription(secretKey, id));
                promises.push(this.repositories.subscription.delete(au.churchId, id));
                return await Promise.all(promises);
            }
        });
    }

    private loadPrivateKey = async (churchId: string) => {
        const gateways = await this.repositories.gateway.loadAll(churchId);
        return (gateways.length === 0) ? "" : EncryptionHelper.decrypt(gateways[0].privateKey);
    }

}
