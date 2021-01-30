import { controller, httpPost, httpGet, interfaces, requestParam, httpDelete, results } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { Donation, DonationSummary } from "../models"
import { Permissions } from '../helpers/Permissions'

@controller("/donations")
export class DonationController extends GivingBaseController {


    @httpGet("/summary")
    public async getSummary(req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.viewSummary)) return this.json({}, 401);
            else {
                const startDate = (req.query.startDate === undefined) ? new Date(2000, 1, 1) : new Date(req.query.startDate.toString());
                const endDate = (req.query.endDate === undefined) ? new Date() : new Date(req.query.endDate.toString());
                const result = await this.repositories.donation.loadSummary(au.churchId, startDate, endDate);
                return this.repositories.donation.convertAllToSummary(au.churchId, result);
            }
        });
    }

    @httpGet("/:id")
    public async get(@requestParam("id") id: number, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.view)) return this.json({}, 401);
            else {
                const data = await this.repositories.donation.load(au.churchId, id);
                const result = this.repositories.donation.convertToModel(au.churchId, data);
                return result;
            }
        });
    }

    @httpGet("/")
    public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.view)) return this.json({}, 401);
            else {
                let result;
                if (req.query.batchId !== undefined) result = await this.repositories.donation.loadByBatchId(au.churchId, parseInt(req.query.batchId.toString(), 0));
                else if (req.query.personId !== undefined) result = await this.repositories.donation.loadByPersonId(au.churchId, parseInt(req.query.personId.toString(), 0));
                else result = await this.repositories.donation.loadAll(au.churchId);
                return this.repositories.donation.convertAllToModel(au.churchId, result);
            }
        });
    }


    @httpPost("/")
    public async save(req: express.Request<{}, {}, Donation[]>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.edit)) return this.json({}, 401);
            else {
                const promises: Promise<Donation>[] = [];
                req.body.forEach(donation => { donation.churchId = au.churchId; promises.push(this.repositories.donation.save(donation)); });
                const result = await Promise.all(promises);
                return this.repositories.donation.convertAllToModel(au.churchId, result);
            }
        });
    }

    @httpDelete("/:id")
    public async delete(@requestParam("id") id: number, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.edit)) return this.json({}, 401);
            else await this.repositories.donation.delete(au.churchId, id);
        });
    }

}
