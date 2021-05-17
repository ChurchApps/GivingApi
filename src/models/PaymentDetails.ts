export interface PaymentDetails {
    amount: number;
    currency: string;
    customer: string;
    payment_method?: string;
    source?: string;
    description?: string;
    off_session?: boolean,
    confirm?: boolean,
}