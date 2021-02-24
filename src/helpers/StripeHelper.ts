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

    private static getStripeObj = (secretKey: string) => {
        return new Stripe(secretKey, { apiVersion: '2020-08-27' });
    }
}