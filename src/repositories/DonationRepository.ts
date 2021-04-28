import { injectable } from "inversify";
import { DB } from "../apiBase/db";
import { Donation, DonationSummary } from "../models";
import { ArrayHelper, DateTimeHelper } from "../helpers"
import { UniqueIdHelper } from "../helpers";

@injectable()
export class DonationRepository {

    public save(donation: Donation) {
        if (donation.personId === "") donation.personId = null;
        if (UniqueIdHelper.isMissing(donation.id)) return this.create(donation); else return this.update(donation);
    }

    public async create(donation: Donation) {
        donation.id = UniqueIdHelper.shortId();
        const donationDate = DateTimeHelper.toMysqlDate(donation.donationDate)
        const sql = "INSERT INTO donations (id, churchId, batchId, personId, donationDate, amount, method, methodDetails, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);";
        const params = [donation.id, donation.churchId, donation.batchId, donation.personId, donationDate, donation.amount, donation.method, donation.methodDetails, donation.notes];
        await DB.query(sql, params);
        return donation;
    }

    public async update(donation: Donation) {
        const donationDate = DateTimeHelper.toMysqlDate(donation.donationDate)
        const sql = "UPDATE donations SET batchId=?, personId=?, donationDate=?, amount=?, method=?, methodDetails=?, notes=? WHERE id=? and churchId=?";
        const params = [donation.batchId, donation.personId, donationDate, donation.amount, donation.method, donation.methodDetails, donation.notes, donation.id, donation.churchId]
        await DB.query(sql, params)
        return donation;
    }

    public delete(churchId: string, id: string) {
        return DB.query("DELETE FROM donations WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public load(churchId: string, id: string) {
        return DB.queryOne("SELECT * FROM donations WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public loadAll(churchId: string) {
        return DB.query("SELECT * FROM donations WHERE churchId=?;", [churchId]);
    }

    public loadByBatchId(churchId: string, batchId: string) {
        return DB.query("SELECT d.* FROM donations d WHERE d.churchId=? AND d.batchId=?;", [churchId, batchId]);
    }

    public loadByMethodDetails(churchId: string, method: string, methodDetails: string) {
        return DB.queryOne("SELECT d.* FROM donations d WHERE d.churchId=? AND d.method=? AND d.methodDetails=?;", [churchId, method, methodDetails]);
    }

    public loadByPersonId(churchId: string, personId: string) {
        const sql = "SELECT d.*, f.id as fundId, f.name as fundName"
            + " FROM donations d"
            + " INNER JOIN fundDonations fd on fd.donationId = d.id"
            + " INNER JOIN funds f on f.id = fd.fundId"
            + " WHERE d.churchId = ? AND d.personId = ?";
        return DB.query(sql, [churchId, personId]);
    }

    public loadSummary(churchId: string, startDate: Date, endDate: Date) {
        const sDate = DateTimeHelper.toMysqlDate(startDate);
        const eDate = DateTimeHelper.toMysqlDate(endDate);
        // const sql = "SELECT week(d.donationDate, 0) as week, SUM(fd.amount) as totalAmount, f.name as fundName"
        const sql = "SELECT STR_TO_DATE(concat(year(d.donationDate), ' ', week(d.donationDate, 0), ' Sunday'), '%X %V %W') AS week, SUM(fd.amount) as totalAmount, f.name as fundName"
            + " FROM donations d"
            + " INNER JOIN fundDonations fd on fd.donationId = d.id"
            + " INNER JOIN funds f on f.id = fd.fundId"
            + " WHERE d.churchId=?"
            + " AND d.donationDate BETWEEN ? AND ?"
            + " GROUP BY year(d.donationDate), week(d.donationDate, 0), f.name"
            + " ORDER BY year(d.donationDate), week(d.donationDate, 0), f.name";
        return DB.query(sql, [churchId, sDate, eDate]);
    }


    public convertToModel(churchId: string, data: any) {
        const result: Donation = { id: data.id, batchId: data.batchId, personId: data.personId, donationDate: data.donationDate, amount: data.amount, method: data.method, methodDetails: data.methodDetails, notes: data.notes };
        if (data.fundName !== undefined) result.fund = { id: data.fundId, name: data.fundName };
        return result;
    }

    public convertAllToModel(churchId: string, data: any[]) {
        const result: Donation[] = [];
        data.forEach(d => result.push(this.convertToModel(churchId, d)));
        return result;
    }

    public convertAllToSummary(churchId: string, data: any[]) {
        const result: DonationSummary[] = [];
        data.forEach(d => {
            const week = d.week;
            let weekRow: DonationSummary = ArrayHelper.getOne(result, "week", week);
            if (weekRow === null) {
                weekRow = { week, donations: [] }
                result.push(weekRow);
            }
            weekRow.donations.push({ fund: { name: d.fundName }, totalAmount: d.totalAmount });
        });
        return result;
    }

}
