import { controller, httpPost, httpGet, interfaces, requestParam, httpDelete } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { Gateway } from "../models"
import { EncryptionHelper, StripeHelper } from "../helpers"
import { Permissions } from "../helpers/Permissions"

@controller("/gateways")
export class GatewayController extends GivingBaseController {

  @httpGet("/churchId/:churchId")
  public async getForChurch(@requestParam("churchId") churchId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
    return this.actionWrapperAnon(req, res, async () => {
      return this.repositories.gateway.convertAllToModel(churchId, await this.repositories.gateway.loadAll(churchId));
    });
  }

  @httpGet("/:id")
  public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.settings.edit)) return this.json({}, 401);
      else return this.repositories.gateway.convertToModel(au.churchId, await this.repositories.gateway.load(au.churchId, id));
    });
  }

  @httpGet("/")
  public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
    return this.actionWrapper(req, res, async (au) => {
      return this.repositories.gateway.convertAllToModel(au.churchId, await this.repositories.gateway.loadAll(au.churchId));
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, Gateway[]>, res: express.Response): Promise<interfaces.IHttpActionResult> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.settings.edit)) return this.json({}, 401);
      else {
        const promises: Promise<Gateway>[] = [];
        await Promise.all(req.body.map(async gateway => {
          if (gateway.provider === 'Stripe') {
            if (req.hostname !== 'localhost') {
              await StripeHelper.deleteWebhooksByChurchId(gateway.privateKey, au.churchId);
              const webHookUrl = req.get('x-forwarded-proto') + '://' + req.hostname + '/donate/webhook/stripe?churchId=' + au.churchId;
              const webhook = await StripeHelper.createWebhookEndpoint(gateway.privateKey, webHookUrl);
              gateway.webhookKey = EncryptionHelper.encrypt(webhook.secret);
            }
            gateway.productId = await StripeHelper.createProduct(gateway.privateKey, au.churchId);
          }
          gateway.churchId = au.churchId;
          gateway.privateKey = EncryptionHelper.encrypt(gateway.privateKey);
          await promises.push(this.repositories.gateway.save(gateway));
        }));
        const result = await Promise.all(promises);
        return this.repositories.gateway.convertAllToModel(au.churchId, result);
      }
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.settings.edit)) return this.json({}, 401);
      else {
        const gateway = await this.repositories.gateway.load(au.churchId, id);
        if (gateway.provider === "Stripe") await StripeHelper.deleteWebhooksByChurchId(gateway.privateKey, au.churchId);
        await this.repositories.gateway.delete(au.churchId, id);
      }
    });
  }

}
