import { controller, httpPost, httpGet, interfaces, requestParam, httpDelete } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
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
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (!au.checkAccess(Permissions.settings.edit) || secretKey === "") return this.json({}, 401);
            else {
                const customer = await this.repositories.paymentMethod.loadCustomerId(au.churchId, id);
                return customer ? await StripeHelper.getCustomerPaymentMethods(secretKey, customer) : [];
            }
        });
    }

    @httpPost("/addcard")
    public async addCard(req: express.Request<any>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (!au.checkAccess(Permissions.settings.edit) || secretKey === "") return this.json({}, 401);
            else {
                const { id, personId, email, customerId } = req.body;
                const customer = customerId || await StripeHelper.createCustomer(secretKey, email);
                const stripePaymentMethod = await StripeHelper.attachPaymentMethod(secretKey, id, {customer});
                const pm = { id, churchId: au.churchId, personId, customerId: customer };
                this.repositories.paymentMethod.save(pm);
                return stripePaymentMethod;
            }
        });
    }

    @httpPost("/updatecard")
    public async updateCard(req: express.Request<any>, res: express.Response): Promise<any> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (!au.checkAccess(Permissions.settings.edit) || secretKey === "") return this.json({}, 401);
            else {
                const { paymentMethodId, cardData } = req.body;
                return await StripeHelper.updateCard(secretKey, paymentMethodId, cardData);
            }
        });
    }

    @httpPost("/addbankaccount")
    public async addBankAccount(req: express.Request<any>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (!au.checkAccess(Permissions.settings.edit) || secretKey === "") return this.json({}, 401);
            else {
                const { id, personId, personEmail, customerId } = req.body;
                const customer = customerId || await StripeHelper.createCustomer(secretKey, personEmail);
                const bankAccount = await StripeHelper.createBankAccount(secretKey, customer, {source: id})
                const pm = { id: bankAccount.id, churchId: au.churchId, personId, customerId: customer };
                this.repositories.paymentMethod.save(pm);
                return bankAccount;
            }
        });
    }

    @httpPost("/updatebank")
    public async updateBank(req: express.Request<any>, res: express.Response): Promise<any> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (!au.checkAccess(Permissions.settings.edit) || secretKey === "") return this.json({}, 401);
            else {
                const { paymentMethodId, bankData, customerId } = req.body;
                return await StripeHelper.updateBank(secretKey, paymentMethodId, bankData, customerId);
            }
        });
    }

    @httpPost("/verifybank")
    public async verifyBank(req: express.Request<any>, res: express.Response): Promise<any> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (!au.checkAccess(Permissions.settings.edit) || secretKey === "") return this.json({}, 401);
            else {
                const { paymentMethodId, customerId, amountData } = req.body;
                return await StripeHelper.verifyBank(secretKey, paymentMethodId, amountData, customerId);
            }
        });
    }

    @httpDelete("/:id/:customerid")
    public async delete(@requestParam("id") id: string, @requestParam("customerid") customerId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (!au.checkAccess(Permissions.settings.edit) || secretKey === "") return this.json({}, 401);
            else {
                const paymentType = id.substring(0,2);
                if (paymentType === 'pm') await StripeHelper.detachPaymentMethod(secretKey, id);
                if (paymentType === 'ba') await StripeHelper.deleteBankAccount(secretKey, customerId, id);
                await this.repositories.paymentMethod.delete(au.churchId, id);
            }
        });
    }

    private loadPrivateKey = async (churchId: string) => {
        const gateways = await this.repositories.gateway.loadAll(churchId);
        const result = (gateways.length === 0) ? "" : EncryptionHelper.decrypt(gateways[0].privateKey);
        return result;
    }
}