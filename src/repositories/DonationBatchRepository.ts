import { injectable } from "inversify";
import { DB } from "@churchapps/apihelper";
import { DonationBatch } from "../models";
import { UniqueIdHelper, DateHelper } from "@churchapps/apihelper";

@injectable()
export class DonationBatchRepository {
  public async getOrCreateCurrent(churchId: string) {
    const data = await DB.queryOne("SELECT * FROM donationBatches WHERE churchId=? ORDER by batchDate DESC LIMIT 1;", [
      churchId
    ]);
    if (data !== null) return this.convertToModel(churchId, data);
    else {
      const batch: DonationBatch = { churchId, name: "Online Donation", batchDate: new Date() };
      await this.save(batch);
      return batch;
    }
  }

  public save(donationBatch: DonationBatch) {
    return donationBatch.id ? this.update(donationBatch) : this.create(donationBatch);
  }

  private async create(donationBatch: DonationBatch) {
    donationBatch.id = UniqueIdHelper.shortId();
    const batchDate = DateHelper.toMysqlDate(donationBatch.batchDate);
    const sql = "INSERT INTO donationBatches (id, churchId, name, batchDate) VALUES (?, ?, ?, ?);";
    const params = [donationBatch.id, donationBatch.churchId, donationBatch.name, batchDate];
    await DB.query(sql, params);
    return donationBatch;
  }

  private async update(donationBatch: DonationBatch) {
    const batchDate = DateHelper.toMysqlDate(donationBatch.batchDate);
    const sql = "UPDATE donationBatches SET name=?, batchDate=? WHERE id=? and churchId=?";
    const params = [donationBatch.name, batchDate, donationBatch.id, donationBatch.churchId];
    await DB.query(sql, params);
    return donationBatch;
  }

  public delete(churchId: string, id: string) {
    return DB.query("DELETE FROM donationBatches WHERE id=? AND churchId=?;", [id, churchId]);
  }

  public load(churchId: string, id: string) {
    return DB.queryOne("SELECT * FROM donationBatches WHERE id=? AND churchId=?;", [id, churchId]);
  }

  public loadAll(churchId: string) {
    const sql =
      "SELECT *" +
      " , IFNULL((SELECT Count(*) FROM donations WHERE batchId = db.Id),0) AS donationCount" +
      " , IFNULL((SELECT SUM(amount) FROM donations WHERE batchId = db.Id),0) AS totalAmount" +
      " FROM donationBatches db" +
      " WHERE db.churchId = ?";
    return DB.query(sql, [churchId]);
  }

  public convertToModel(churchId: string, data: any) {
    const result: DonationBatch = {
      id: data.id,
      name: data.name,
      batchDate: data.batchDate,
      donationCount: data.donationCount,
      totalAmount: data.totalAmount
    };
    return result;
  }

  public convertAllToModel(churchId: string, data: any[]) {
    const result: DonationBatch[] = [];
    data.forEach((d) => result.push(this.convertToModel(churchId, d)));
    return result;
  }
}
