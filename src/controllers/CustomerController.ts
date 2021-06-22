import { controller, httpPost, httpGet, interfaces, requestParam, httpDelete } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { Permissions } from '../helpers/Permissions'

@controller("/customers")
export class CustomerController extends GivingBaseController {

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

}
