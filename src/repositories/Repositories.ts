import { DonationRepository, DonationBatchRepository, FundDonationRepository, FundRepository } from ".";
import { GatewayRepository } from "./GatewayRepository";
import { PaymentMethodRepository } from "./PaymentMethodRepository";

export class Repositories {
    public donationBatch: DonationBatchRepository;
    public donation: DonationRepository;
    public fundDonation: FundDonationRepository;
    public fund: FundRepository;
    public gateway: GatewayRepository;
    public paymentMethod: PaymentMethodRepository;


    private static _current: Repositories = null;
    public static getCurrent = () => {
        if (Repositories._current === null) Repositories._current = new Repositories();
        return Repositories._current;
    }

    constructor() {
        this.donationBatch = new DonationBatchRepository();
        this.donation = new DonationRepository();
        this.fundDonation = new FundDonationRepository();
        this.fund = new FundRepository();
        this.gateway = new GatewayRepository();
        this.paymentMethod = new PaymentMethodRepository();
    }
}
