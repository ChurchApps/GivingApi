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
            const permission = secretKey && (au.checkAccess(Permissions.donations.view) || id === au.personId);
            if (!permission) return this.json({}, 401);
            else {
                const customer = await this.repositories.customer.loadByPersonId(au.churchId, id);
                return customer ? await StripeHelper.getCustomerPaymentMethods(secretKey, customer) : [];
            }
        });
    }

    @httpPost("/addcard")
    public async addCard(req: express.Request<any>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            const { id, personId, customerId, email, name } = req.body;
            const permission = secretKey && (au.checkAccess(Permissions.donations.edit) || personId === au.personId);
            if (!permission) return this.json({}, 401);
            else {
                let customer = customerId;
                if (!customer) {
                    customer = await StripeHelper.createCustomer(secretKey, email, name);
                    this.repositories.customer.save({ id: customer, churchId: au.churchId, personId });
                }
                try { return await StripeHelper.attachPaymentMethod(secretKey, id, {customer}); }
                catch (e) { return e; }
            }
        });
    }

    @httpPost("/updatecard")
    public async updateCard(req: express.Request<any>, res: express.Response): Promise<any> {
        return this.actionWrapper(req, res, async (au) => {
            const { personId, paymentMethodId, cardData } = req.body;
            const secretKey = await this.loadPrivateKey(au.churchId);
            const permission = secretKey && (au.checkAccess(Permissions.donations.edit) || personId === au.personId);
            if (!permission) return this.json({}, 401);
            else return await StripeHelper.updateCard(secretKey, paymentMethodId, cardData);
        });
    }

    @httpPost("/addbankaccount")
    public async addBankAccount(req: express.Request<any>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const { id, personId, customerId, email, name } = req.body;
            const secretKey = await this.loadPrivateKey(au.churchId);
            const permission = secretKey && (au.checkAccess(Permissions.donations.edit) || personId === au.personId);
            if (!permission) return this.json({}, 401);
            else {
                let customer = customerId;
                if (!customer) {
                    customer = await StripeHelper.createCustomer(secretKey, email, name);
                    this.repositories.customer.save({ id: customer, churchId: au.churchId, personId });
                }
                try { return await StripeHelper.createBankAccount(secretKey, customer, {source: id}) }
                catch (e) { return e; }
            }
        });
    }

    @httpPost("/updatebank")
    public async updateBank(req: express.Request<any>, res: express.Response): Promise<any> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            const { paymentMethodId, personId, bankData, customerId } = req.body;
            const permission = secretKey && (au.checkAccess(Permissions.donations.edit) || personId === au.personId);
            if (!permission) return this.json({}, 401);
            else return await StripeHelper.updateBank(secretKey, paymentMethodId, bankData, customerId);
        });
    }

    @httpPost("/verifybank")
    public async verifyBank(req: express.Request<any>, res: express.Response): Promise<any> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            const { paymentMethodId, customerId, amountData } = req.body;
            const permission = secretKey && (au.checkAccess(Permissions.donations.edit) || (await this.repositories.customer.convertToModel(au.churchId, await this.repositories.customer.load(au.churchId, customerId)).personId === au.personId));
            if (!permission) return this.json({}, 401);
            else {
                try { return await StripeHelper.verifyBank(secretKey, paymentMethodId, amountData, customerId); }
                catch (e) { return e; }
            }
        });
    }

    @httpDelete("/:id/:customerid")
    public async delete(@requestParam("id") id: string, @requestParam("customerid") customerId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<interfaces.IHttpActionResult> {
        return this.actionWrapper(req, res, async (au) => {
            const secretKey = await this.loadPrivateKey(au.churchId);
            const permission = secretKey && (au.checkAccess(Permissions.donations.edit) || (await this.repositories.customer.convertToModel(au.churchId, await this.repositories.customer.load(au.churchId, customerId)).personId === au.personId));
            if (!permission) return this.json({}, 401);
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