import Stripe from 'stripe';
import { CheckoutDetails } from "../models";
import { UniqueIdHelper } from '../apiBase';

export class StripeHelper {

    static createCheckoutSession = async (secretKey: string, details: CheckoutDetails) => {

        details.successUrl = details.successUrl + "?sessionId={CHECKOUT_SESSION_ID}";
        const stripe = StripeHelper.getStripeObj(secretKey);
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: { name: 'Donation' },
                        unit_amount: details.amount * 100, // stripe wants prices in pennies
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: details.successUrl,
            cancel_url: details.cancelUrl,
        });
        return session.id;
    }

    static verifySession = async (secretKey: string, sessionId: string) => {
        const stripe = StripeHelper.getStripeObj(secretKey);
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const payment = await stripe.paymentIntents.retrieve(session.payment_intent.toString());

        const bd = payment.charges.data[0].billing_details;
        const receiptUrl = payment.charges.data[0].receipt_url;

        return { session, email: bd.email, name: bd.name, receiptUrl };
    }

    /*
        static createDonor = async () => {
            const stripe = StripeHelper.getStripeObj("");
            const donor: Stripe.Customer = await stripe.customers.create({ description: 'test donor' });
            console.log(donor.id);
        }
        */

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
        const paymentMethods =  await stripe.paymentMethods.list({ customer: customer.customerId, type: 'card' });
        const bankAccounts = await stripe.customers.listSources(customer.customerId, {object: 'bank_account'});
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

    private static getStripeObj = (secretKey: string) => {
        return new Stripe(secretKey, { apiVersion: '2020-08-27' });
    }
}