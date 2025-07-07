import { controller, httpDelete, httpGet, interfaces, requestParam } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController";
import { Permissions } from "../helpers/Permissions";

@controller("/subscriptionfunds")
export class SubscriptionFundController extends GivingBaseController {
  @httpGet("/:id")
  public async get(
    @requestParam("id") id: string,
    req: express.Request<{}, {}, null>,
    res: express.Response
  ): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.donations.viewSummary)) return this.json(null, 401);
      else
        return this.repositories.subscriptionFund.convertToModel(
          au.churchId,
          await this.repositories.subscriptionFund.load(au.churchId, id)
        );
    });
  }

  @httpGet("/")
  public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (req.query.subscriptionId !== undefined) {
        const subscriptionId = req.query.subscriptionId.toString();
        const subscriptionData = await this.repositories.subscription.load(au.churchId, subscriptionId);
        const permission =
          au.checkAccess(Permissions.donations.view) || (subscriptionData as any)?.personId === au.personId;
        if (!permission) return this.json([], 401);
        else
          return await this.repositories.subscriptionFund.loadBySubscriptionId(
            au.churchId,
            req.query.subscriptionId.toString()
          );
      }
      if (!au.checkAccess(Permissions.donations.view)) return this.json([], 401);
      else
        return this.repositories.subscriptionFund.convertAllToModel(
          au.churchId,
          (await this.repositories.subscriptionFund.loadAll(au.churchId)) as any[]
        );
    });
  }

  @httpDelete("/:id")
  public async delete(
    @requestParam("id") id: string,
    req: express.Request<{}, {}, null>,
    res: express.Response
  ): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.donations.edit)) return this.json(null, 401);
      else {
        await this.repositories.subscriptionFund.delete(au.churchId, id);
        return this.json({});
      }
    });
  }

  @httpDelete("/subscription/:id")
  public async deleteBySubscriptionId(
    @requestParam("id") id: string,
    req: express.Request<{}, {}, null>,
    res: express.Response
  ): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const permission =
        au.checkAccess(Permissions.donations.edit) ||
        ((await this.repositories.subscription.load(au.churchId, id)) as any).personId === au.personId;
      if (!permission) return this.json(null, 401);
      else {
        await this.repositories.subscriptionFund.deleteBySubscriptionId(au.churchId, id);
        return this.json({});
      }
    });
  }
}
