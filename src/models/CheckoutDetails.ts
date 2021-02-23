export class CheckoutDetails {
    public churchId: string;
    public amount: number;
    public successUrl: string;
    public cancelUrl: string;

    public email?: string;
    public name?: string;
    public address?: string;
    public city?: string;
    public state?: string;
    public zip?: string;
}
