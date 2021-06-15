import { controller, httpPost, httpGet, interfaces, requestParam, httpDelete } from "inversify-express-utils";
import express from "express";
import { GivingBaseController } from "./GivingBaseController"
import { EncryptionHelper, StripeHelper } from "../helpers"
import { Permissions } from "../helpers/Permissions"

@controller("/paymentmethods")
export class PaymentMethodController extends GivingBaseController {

    @httpGet("/personid/:id")
    public async getPersonPaymentMethods(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (!au.checkAccess(Permissions.donations.edit) || secretKey === "") return this.json({}, 401);
            else {
                const customer = await this.repositories.customer.load(au.churchId, id);
                return customer ? await StripeHelper.getCustomerPaymentMethods(secretKey, customer) : [];
            }
        });
    }

    @httpPost("/addcard")
    public async addCard(req: express.Request<any>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (!au.checkAccess(Permissions.donations.edit) || secretKey === "") return this.json({}, 401);
            else {
                const { id, personId, customerId, email } = req.body;
                let customer = customerId;
                if (!customer) {
                    customer = await StripeHelper.createCustomer(secretKey, email);
                    this.repositories.customer.save({ id: customer, churchId: au.churchId, personId });
                }
                const stripePaymentMethod = await StripeHelper.attachPaymentMethod(secretKey, id, {customer});
                return stripePaymentMethod;
            }
        });
    }

    @httpPost("/updatecard")
    public async updateCard(req: express.Request<any>, res: express.Response): Promise<any> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (!au.checkAccess(Permissions.donations.edit) || secretKey === "") return this.json({}, 401);
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
            if (!au.checkAccess(Permissions.donations.edit) || secretKey === "") return this.json({}, 401);
            else {
                const { id, personId, customerId, email } = req.body;
                let customer = customerId;
                if (!customer) {
                    customer = await StripeHelper.createCustomer(secretKey, email);
                    this.repositories.customer.save({ id: customer, churchId: au.churchId, personId });
                }
                try {
                    const bankAccount = await StripeHelper.createBankAccount(secretKey, customer, {source: id})
                    return bankAccount;
                } catch (e) {
                    return e;
                }
            }
        });
    }

    @httpPost("/updatebank")
    public async updateBank(req: express.Request<any>, res: express.Response): Promise<any> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            if (!au.checkAccess(Permissions.donations.edit) || secretKey === "") return this.json({}, 401);
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
                try {
                    return await StripeHelper.verifyBank(secretKey, paymentMethodId, amountData, customerId);
                } catch(e) {
                    return e;
                }
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
            }
        });
    }

    private loadPrivateKey = async (churchId: string) => {
        const gateways = await this.repositories.gateway.loadAll(churchId);
        return (gateways.length === 0) ? "" : EncryptionHelper.decrypt(gateways[0].privateKey);
    }
}