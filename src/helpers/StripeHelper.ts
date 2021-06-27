import Stripe from 'stripe';
import express from "express";
import { Donation, DonationBatch, EventLog, FundDonation, PaymentDetails } from "../models";
import { Repositories } from '../repositories';

export class StripeHelper {

    static donate = async (secretKey: string, payment: PaymentDetails) => {
        const stripe = StripeHelper.getStripeObj(secretKey);
        payment.amount = payment.amount * 100;
        try {
            if (payment?.payment_method) return await stripe.paymentIntents.create(payment);
            if (payment?.source) return await stripe.charges.create(payment);
        } catch(err) {
            return err;
        }
    }

    static createSubscription = async (secretKey: string, donationData: any) => {
        const stripe = StripeHelper.getStripeObj(secretKey);
        const { customer, metadata, productId, interval, amount, payment_method_id, type } = donationData;
        const subscriptionData: any = {
            customer,
            metadata,
            items: [{
                price_data: {
                  currency: 'usd',
                  product: productId,
                  recurring: interval,
                  unit_amount: amount * 100
              }
            }],
        };
        if (type === 'card') subscriptionData.default_payment_method = payment_method_id;
        if (type === 'bank') subscriptionData.default_source = payment_method_id;
        return await stripe.subscriptions.create(subscriptionData);
    }

    static updateSubscription = async (secretKey: string, sub: any) => {
        const stripe = StripeHelper.getStripeObj(secretKey);
        const paymentMethod: any = { default_payment_method: null, default_source: null };
        if (sub.default_payment_method) paymentMethod.default_payment_method = sub.default_payment_method;
        if (sub.default_source) paymentMethod.default_source = sub.default_source;
        return await stripe.subscriptions.update(sub.id, paymentMethod);
    }

    static deleteSubscription = async (secretKey: string, subscriptionId: string) => {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.subscriptions.del(subscriptionId);
    }

    static getCustomerSubscriptions = async (secretKey: string, customerId: string) => {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.subscriptions.list({ customer: customerId });
    }

    static getCharge = async (secretKey: string, chargeId: string) => {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.charges.retrieve(chargeId);
    }

    static createProduct = async (secretKey: string, churchId: string) => {
        const stripe = StripeHelper.getStripeObj(secretKey);
        const product = await stripe.products.create({ name: 'Donation', metadata: { churchId }});
        return product.id;
    }

    static createCustomer = async (secretKey: string, email: string) => {
        const stripe = StripeHelper.getStripeObj(secretKey);
        const customer = await stripe.customers.create({email});
        return customer.id;
    }

    static async addCard(secretKey: string, customerId: string, paymentMethod: any) {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.customers.createSource(customerId, paymentMethod);
    }

    static async updateCard(secretKey: string, paymentMethodId: string, card: any) {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.paymentMethods.update(paymentMethodId, card);
    }

    static async attachPaymentMethod(secretKey: string, paymentMethodId: string, customer: any) {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.paymentMethods.attach(paymentMethodId, customer);
    }

    static async createBankAccount(secretKey: string, customerId: string, source: any) {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.customers.createSource(customerId, source);
    }

    static async updateBank(secretKey: string, paymentMethodId: string, bankData: any, customerId: string) {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.customers.updateSource(customerId, paymentMethodId, bankData);
    }

    static async verifyBank(secretKey: string, paymentMethodId: string, amountData: any, customerId: string) {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.customers.verifySource(customerId, paymentMethodId, amountData);
    }

    static async getCustomerPaymentMethods(secretKey: string, customer: any) {
        const stripe = StripeHelper.getStripeObj(secretKey);
        const paymentMethods =  await stripe.paymentMethods.list({ customer: customer.id, type: 'card' });
        const bankAccounts = await stripe.customers.listSources(customer.id, {object: 'bank_account'});
        return [{cards: paymentMethods, banks: bankAccounts, customer}];
    }

    static async detachPaymentMethod(secretKey: string, paymentMethodId: string) {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.paymentMethods.detach(paymentMethodId);
    }

    static async deleteBankAccount(secretKey: string, customerId: string, paymentMethodId: string) {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.customers.deleteSource(customerId, paymentMethodId);
    }

    static async viewWebhooks(secretKey: string) {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.webhookEndpoints.list({ limit: 1 });
    }

    static async createWebhookEndpoint(secretKey: string, webhookUrl: string) {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.webhookEndpoints.create({
          url: webhookUrl,
          enabled_events: [
            'invoice.paid',
            'charge.succeeded',
            'charge.failed'
          ],
        });
    }

    static async verifySignature(secretKey: string, request: express.Request, sig: string, endpointSecret: string) {
        const stripe = StripeHelper.getStripeObj(secretKey);
        return await stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    }

    static async getPaymentDetails(secretKey: string, eventData: any) {
        const { payment_method_details } = eventData.payment_method_details ? eventData : await this.getCharge(secretKey, eventData.charge);
        const methodTypes: any = { ach_debit: 'ACH Debit', card: 'Card' };
        const paymentType = payment_method_details.type;
        return { method: methodTypes[paymentType], methodDetails: payment_method_details[paymentType].last4 };
    }

    static async logEvent(churchId: string, stripeEvent: any, eventData: any) {
        const { billing_reason, status, failure_message, outcome, created, customer } = eventData;
        let message = billing_reason + ' ' + status;
        if (!billing_reason) message = failure_message ? failure_message + ' ' + outcome.seller_message : outcome.seller_message;
        const eventLog: EventLog = { id: stripeEvent.id, churchId, customerId: customer, provider: 'Stripe', eventType: stripeEvent.type, status, message, created: new Date(created * 1000) };
        return Repositories.getCurrent().eventLog.create(eventLog);
    }

    static async logDonation(secretKey: string, churchId: string, eventData: any) {
        const amount = (eventData.amount || eventData.amount_paid) / 100;
        const { personId } = await Repositories.getCurrent().customer.load(churchId, eventData.customer);
        const { method, methodDetails } = await this.getPaymentDetails(secretKey, eventData);
        const batch: DonationBatch = await Repositories.getCurrent().donationBatch.getOrCreateCurrent(churchId);
        const donationData: Donation = { batchId: batch.id, amount, churchId, personId, method, methodDetails, donationDate: new Date(eventData.created * 1000) };
        const funds = eventData.metadata.funds ? JSON.parse(eventData.metadata.funds) : await Repositories.getCurrent().subscriptionFund.loadBySubscriptionId(churchId, eventData.subscription);
        const donation: Donation = await Repositories.getCurrent().donation.save(donationData);
        const promises: Promise<FundDonation>[] = [];
        funds.forEach((fund: FundDonation) => {
            const fundDonation: FundDonation = { churchId, amount: fund.amount, donationId: donation.id, fundId: fund.id };
            promises.push(Repositories.getCurrent().fundDonation.save(fundDonation));
        });
        return await Promise.all(promises);
    }

    private static getStripeObj = (secretKey: string) => {
        return new Stripe(secretKey, { apiVersion: '2020-08-27' });
    }
}