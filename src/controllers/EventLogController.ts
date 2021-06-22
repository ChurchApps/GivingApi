import { controller, httpPost, httpGet, interfaces, requestParam, httpDelete } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { Permissions } from '../helpers/Permissions'

@controller("/eventLog")
export class EventLogController extends GivingBaseController {

    @httpGet("/:id")
    public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.viewSummary)) return this.json({}, 401);
            else return this.repositories.eventLog.convertToModel(await this.repositories.eventLog.load(au.churchId, id));
        });
    }

    @httpGet("/type/:type")
    public async getByType(@requestParam("type") type: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.viewSummary)) return this.json({}, 401);
            return this.repositories.eventLog.convertAllToModel(await this.repositories.eventLog.loadByType(au.churchId, type));
        });
    }

    @httpGet("/")
    public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.viewSummary)) return this.json({}, 401);
            else return this.repositories.eventLog.convertAllToModel(await this.repositories.eventLog.loadAll(au.churchId));
        });
    }

}
