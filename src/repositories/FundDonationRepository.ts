import { injectable } from "inversify";
import { DB } from "../apiBase/db";
import { FundDonation } from "../models";
import { UniqueIdHelper, DateTimeHelper } from "../helpers";

@injectable()
export class FundDonationRepository {

    public async save(fundDonation: FundDonation) {
        if (UniqueIdHelper.isMissing(fundDonation.id)) return this.create(fundDonation); else return this.update(fundDonation);
    }

    public async create(fundDonation: FundDonation) {
        fundDonation.id = UniqueIdHelper.shortId();
        return DB.query(
            "INSERT INTO fundDonations (id, churchId, donationId, fundId, amount) VALUES (?, ?, ?, ?, ?);",
            [fundDonation.id, fundDonation.churchId, fundDonation.donationId, fundDonation.fundId, fundDonation.amount]
        ).then(() => { return fundDonation; });
    }

    public async update(fundDonation: FundDonation) {
        return DB.query(
            "UPDATE fundDonations SET donationId=?, fundId=?, amount=? WHERE id=? and churchId=?",
            [fundDonation.donationId, fundDonation.fundId, fundDonation.amount, fundDonation.id, fundDonation.churchId]
        ).then(() => { return fundDonation });
    }

    public async delete(churchId: string, id: string) {
        DB.query("DELETE FROM fundDonations WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async load(churchId: string, id: string) {
        return DB.queryOne("SELECT * FROM fundDonations WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async loadAll(churchId: string) {
        return DB.query("SELECT * FROM fundDonations WHERE churchId=?;", [churchId]);
    }

    public async loadByDonationId(churchId: string, donationId: string) {
        return DB.query("SELECT * FROM fundDonations WHERE churchId=? AND donationId=?;", [churchId, donationId]);
    }

    public async loadByFundId(churchId: string, fundId: string) {
        return DB.query("SELECT fd.*, d.donationDate, d.batchId, d.personId, FROM fundDonations fd INNER JOIN donations d ON d.id=fd.donationId WHERE fd.churchId=? AND fd.fundId=? ORDER by d.donationDate desc;", [churchId, fundId]);
    }

    public async loadByFundIdDate(churchId: string, fundId: string, startDate: Date, endDate: Date) {
        return DB.query("SELECT fd.*, d.donationDate, d.batchId, d.personId FROM fundDonations fd INNER JOIN donations d ON d.id=fd.donationId WHERE fd.churchId=? AND fd.fundId=? AND d.donationDate BETWEEN ? AND ? ORDER by d.donationDate desc;", [churchId, fundId, DateTimeHelper.toMysqlDate(startDate), DateTimeHelper.toMysqlDate(endDate)]);
    }

    public convertToModel(churchId: string, data: any) {
        const result: FundDonation = { id: data.id, donationId: data.donationId, fundId: data.fundId, amount: data.amount };
        if (data.batchId !== undefined) {
            result.donation = { id: result.donationId, donationDate: data.donationDate, batchId: data.batchId, personId: data.personId };
        }
        return result;
    }

    public convertAllToModel(churchId: string, data: any[]) {
        const result: FundDonation[] = [];
        data.forEach(d => result.push(this.convertToModel(churchId, d)));
        return result;
    }

}
