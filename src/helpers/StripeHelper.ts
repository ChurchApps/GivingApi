import Stripe from 'stripe';
import express from "express";
import { PaymentDetails } from "../models";

export class StripeHelper {

    static donate = async (secretKey: string, payment: PaymentDetails) => {
        const stripe = StripeHelper.getStripeObj(secretKey);
        payment.amount = payment.amount * 100;
        if (payment?.payment_method) return await stripe.paymentIntents.create(payment);
        if (payment?.source) return await stripe.charges.create(payment);
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

    private static getStripeObj = (secretKey: string) => {
        return new Stripe(secretKey, { apiVersion: '2020-08-27' });
    }
}