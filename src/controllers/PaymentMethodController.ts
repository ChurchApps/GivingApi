import { controller, httpPost, httpGet, interfaces, requestParam, httpDelete, httpMethod, httpPatch } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { PaymentMethod } from "../models"
import { EncryptionHelper, StripeHelper } from "../helpers"
import { Permissions } from "../helpers/Permissions"

@controller("/paymentmethods")
export class PaymentMethodController extends GivingBaseController {

    @httpGet("/:id")
    public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.settings.edit)) return this.json({}, 401);
            else return this.repositories.paymentMethod.convertToModel(au.churchId, await this.repositories.paymentMethod.load(au.churchId, id));
        });
    }

    @httpGet("/personid/:id")
    public async getPersonPaymentMethods(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.settings.edit)) return this.json({}, 401);
            else {
                const customer = await this.repositories.paymentMethod.loadCustomerId(au.churchId, id);
                return await StripeHelper.getCustomerPaymentMethods(customer);
            }
        });
    }

    @httpPost("/addcard")
    public async addCard(req: express.Request<any>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.settings.edit)) return this.json({}, 401);
            else {
                const { paymentMethod, personId, personEmail, customerId } = req.body;
                const customer = customerId || await StripeHelper.createCustomer(personEmail);
                const stripePaymentMethod = await StripeHelper.attachPaymentMethod(paymentMethod.id, {customer});
                const pm = { id: paymentMethod.id, churchId: au.churchId, personId, customerId: customer };
                const result = this.repositories.paymentMethod.save(pm);
                return this.repositories.paymentMethod.convertToModel(au.churchId, result);
            }
        });
    }

    @httpPost("/updatecard")
    public async updateCard(req: express.Request<any>, res: express.Response): Promise<any> {

        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.settings.edit)) return this.json({}, 401);
            else {
                const { paymentMethodId, cardData } = req.body;
                return await StripeHelper.updateCard(paymentMethodId, cardData);
            }
        });
    }

    @httpPost("/addbankaccount")
    public async addBankAccount(req: express.Request<any>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.settings.edit)) return this.json({}, 401);
            else {
                const { token, personId, personEmail, customerId } = req.body;
                const customer = customerId || await StripeHelper.createCustomer(personEmail);
                const bankAccount = await StripeHelper.createBankAccount(customerId, {source: token.id})
                const pm = { id: bankAccount.id, churchId: au.churchId, personId, customerId: customer };
                const result = this.repositories.paymentMethod.save(pm);
                return this.repositories.paymentMethod.convertToModel(au.churchId, result);
            }
        });
    }

    @httpPost("/updatebank")
    public async updateBank(req: express.Request<any>, res: express.Response): Promise<any> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.settings.edit)) return this.json({}, 401);
            else {
                const { paymentMethodId, bankData, customerId } = req.body;
                return await StripeHelper.updateBank(paymentMethodId, bankData, customerId);
            }
        });
    }

    @httpDelete("/:id/:customerid")
    public async delete(@requestParam("id") id: string, @requestParam("customerid") customerId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.settings.edit)) return this.json({}, 401);
            else {
                const paymentType = id.substring(0,2);
                if (paymentType === 'pm') await StripeHelper.detachPaymentMethod(id);
                if (paymentType === 'ba') await StripeHelper.deleteBankAccount(customerId, id);
                await this.repositories.paymentMethod.delete(au.churchId, id);
            }
        });
    }
}