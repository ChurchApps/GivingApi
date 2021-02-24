import { injectable } from "inversify";
import { DB } from "../apiBase/db";
import { DonationBatch } from "../models";
import { DateTimeHelper } from '../helpers'
import { UniqueIdHelper } from "../helpers";

@injectable()
export class DonationBatchRepository {

    public async getOrCreateCurrent(churchId: string) {
        const data = await DB.queryOne("SELECT * FROM donationBatches WHERE churchId=? ORDER by batchDate DESC LIMIT 1;", [churchId]);
        if (data !== null) return this.convertToModel(churchId, data);
        else {
            const batch: DonationBatch = { churchId, name: "Online Donation", batchDate: new Date() };
            await this.save(batch);
            return batch;
        }
    }

    public async save(donationBatch: DonationBatch) {
        if (UniqueIdHelper.isMissing(donationBatch.id)) return this.create(donationBatch); else return this.update(donationBatch);
    }

    public async create(donationBatch: DonationBatch) {
        donationBatch.id = UniqueIdHelper.shortId();
        const batchDate = DateTimeHelper.toMysqlDate(donationBatch.batchDate);
        return DB.query(
            "INSERT INTO donationBatches (id, churchId, name, batchDate) VALUES (?, ?, ?, ?);",
            [donationBatch.id, donationBatch.churchId, donationBatch.name, batchDate]
        ).then(() => { return donationBatch; });
    }

    public async update(donationBatch: DonationBatch) {
        const batchDate = DateTimeHelper.toMysqlDate(donationBatch.batchDate);
        return DB.query(
            "UPDATE donationBatches SET name=?, batchDate=? WHERE id=? and churchId=?",
            [donationBatch.name, batchDate, donationBatch.id, donationBatch.churchId]
        ).then(() => { return donationBatch });
    }

    public async delete(churchId: string, id: string) {
        DB.query("DELETE FROM donationBatches WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async load(churchId: string, id: string) {
        return DB.queryOne("SELECT * FROM donationBatches WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async loadAll(churchId: string) {
        const sql = "SELECT *"
            + " , IFNULL((SELECT Count(*) FROM donations WHERE batchId = db.Id),0) AS donationCount"
            + " , IFNULL((SELECT SUM(amount) FROM donations WHERE batchId = db.Id),0) AS totalAmount"
            + " FROM donationBatches db"
            + " WHERE db.churchId = ?";
        return DB.query(sql, [churchId]);
    }

    public convertToModel(churchId: string, data: any) {
        const result: DonationBatch = { id: data.id, name: data.name, batchDate: data.batchDate, donationCount: data.donationCount, totalAmount: data.totalAmount };
        return result;
    }

    public convertAllToModel(churchId: string, data: any[]) {
        const result: DonationBatch[] = [];
        data.forEach(d => result.push(this.convertToModel(churchId, d)));
        return result;
    }

}
