import { controller, httpPost, httpGet, interfaces, requestParam, httpDelete } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { Gateway } from "../models"
import { Permissions } from '../helpers/Permissions'

@controller("/gateways")
export class GatewayController extends GivingBaseController {

    @httpGet("/:id")
    public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.edit)) return this.json({}, 401);
            else return this.repositories.gateway.convertToModel(au.churchId, await this.repositories.gateway.load(au.churchId, id));
        });
    }

    @httpGet("/")
    public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.viewSummary)) return this.json({}, 401);
            else return this.repositories.gateway.convertAllToModel(au.churchId, await this.repositories.gateway.loadAll(au.churchId));
        });
    }

    @httpPost("/")
    public async save(req: express.Request<{}, {}, Gateway[]>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.edit)) return this.json({}, 401);
            else {
                const promises: Promise<Gateway>[] = [];
                req.body.forEach(gateway => { gateway.churchId = au.churchId; promises.push(this.repositories.gateway.save(gateway)); });
                const result = await Promise.all(promises);
                return this.repositories.gateway.convertAllToModel(au.churchId, result);
            }
        });
    }

    @httpDelete("/:id")
    public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.edit)) return this.json({}, 401);
            else await this.repositories.gateway.delete(au.churchId, id);
        });
    }

}
