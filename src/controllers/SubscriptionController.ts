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
            const secretKey = await this.loadPrivateKey(au.churchId);
            let permission = au.checkAccess(Permissions.donations.edit);
            const promises: Promise<any>[] = [];
            req.body.forEach( async subscription => {
                permission = permission || (await this.repositories.subscription.load(au.churchId, subscription.id)).personId === au.personId;
                if (permission) promises.push(StripeHelper.updateSubscription(secretKey, subscription));
            });
            return await Promise.all(promises);
        });
    }

    @httpDelete("/:id")
    public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            const permission = secretKey && (au.checkAccess(Permissions.donations.edit) || (await this.repositories.subscription.load(au.churchId, id)).personId === au.personId);
            if (!permission) return this.json({}, 401);
            else {
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
