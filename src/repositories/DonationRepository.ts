import { injectable } from "inversify";
import { DB } from "../apiBase/db";
import { Donation, DonationSummary } from "../models";
import { DateTimeHelper } from "../helpers"

@injectable()
export class DonationRepository {

    public async save(donation: Donation) {
        if (donation.personId === 0) donation.personId = null;
        if (donation.id > 0) return this.update(donation); else return this.create(donation);
    }

    public async create(donation: Donation) {
        const donationDate = DateTimeHelper.toMysqlDate(donation.donationDate)
        return DB.query(
            "INSERT INTO donations (churchId, batchId, personId, donationDate, amount, method, methodDetails, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
            [donation.churchId, donation.batchId, donation.personId, donationDate, donation.amount, donation.method, donation.methodDetails, donation.notes]
        ).then((row: any) => { donation.id = row.insertId; return donation; });
    }

    public async update(donation: Donation) {
        const donationDate = DateTimeHelper.toMysqlDate(donation.donationDate)
        const sql = "UPDATE donations SET batchId=?, personId=?, donationDate=?, amount=?, method=?, methodDetails=?, notes=? WHERE id=? and churchId=?";
        const params = [donation.batchId, donation.personId, donationDate, donation.amount, donation.method, donation.methodDetails, donation.notes, donation.id, donation.churchId]
        return DB.query(sql, params).then(() => { return donation });
    }

    public async delete(churchId: number, id: number) {
        DB.query("DELETE FROM donations WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async load(churchId: number, id: number) {
        return DB.queryOne("SELECT * FROM donations WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async loadAll(churchId: number) {
        return DB.query("SELECT * FROM donations WHERE churchId=?;", [churchId]);
    }

    public async loadByBatchId(churchId: number, batchId: number) {
        return DB.query("SELECT d.* FROM donations d WHERE d.churchId=? AND d.batchId=?;", [churchId, batchId]);
    }

    public async loadByPersonId(churchId: number, personId: number) {
        const sql = "SELECT d.*, f.id as fundId, f.name as fundName"
            + " FROM donations d"
            + " INNER JOIN fundDonations fd on fd.donationId = d.id"
            + " INNER JOIN funds f on f.id = fd.fundId"
            + " WHERE d.churchId = ? AND d.personId = ?";
        return DB.query(sql, [churchId, personId]);
    }

    public async loadSummary(churchId: number, startDate: Date, endDate: Date) {
        const sDate = DateTimeHelper.toMysqlDate(startDate);
        const eDate = DateTimeHelper.toMysqlDate(endDate);
        const sql = "SELECT week(d.donationDate, 0) as week, SUM(fd.amount) as totalAmount, f.name as fundName"
            + " FROM donations d"
            + " INNER JOIN fundDonations fd on fd.donationId = d.id"
            + " INNER JOIN funds f on f.id = fd.fundId"
            + " WHERE d.churchId=?"
            + " AND d.donationDate BETWEEN ? AND ?"
            + " GROUP BY week(d.donationDate, 0), f.name"
            + " ORDER BY week(d.donationDate, 0), f.name";
        return DB.query(sql, [churchId, sDate, eDate]);
    }


    public convertToModel(churchId: number, data: any) {
        const result: Donation = { id: data.id, batchId: data.batchId, personId: data.personId, donationDate: data.donationDate, amount: data.amount, method: data.method, methodDetails: data.methodDetails, notes: data.notes };
        if (data.fundName !== undefined) result.fund = { id: data.fundId, name: data.fundName };
        return result;
    }

    public convertAllToModel(churchId: number, data: any[]) {
        const result: Donation[] = [];
        data.forEach(d => result.push(this.convertToModel(churchId, d)));
        return result;
    }


    public convertToSummary(churchId: number, data: any) {
        const result: DonationSummary = { week: data.week, totalAmount: data.totalAmount };

        if (data.fundName !== undefined) result.fund = { name: data.fundName };
        return result;
    }

    public convertAllToSummary(churchId: number, data: any[]) {
        const result: DonationSummary[] = [];
        data.forEach(d => result.push(this.convertToSummary(churchId, d)));
        return result;
    }

}
