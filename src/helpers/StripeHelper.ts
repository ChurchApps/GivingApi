import Stripe from 'stripe';

export class StripeHelper {

    static createCheckoutSession = async (secretKey: string, amount: number, successUrl: string, cancelUrl: string) => {
        const stripe = StripeHelper.getStripeObj(secretKey);
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: { name: 'Donation' },
                        unit_amount: amount,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: successUrl,
            cancel_url: cancelUrl,
        });
        return session.id;
    }

    static createDonor = async () => {
        const stripe = StripeHelper.getStripeObj("");
        const donor: Stripe.Customer = await stripe.customers.create({ description: 'test donor' });
        console.log(donor.id);
    }

    private static getStripeObj = (secretKey: string) => {
        return new Stripe(secretKey, { apiVersion: '2020-08-27' });
    }
}