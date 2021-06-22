import { injectable } from "inversify";
import { UniqueIdHelper } from "../helpers";
import { DB } from "../apiBase/db";
import { SubscriptionFund } from "../models";

@injectable()
export class SubscriptionFundsRepository {

    public async save(subscriptionFund: SubscriptionFund) {
        if (UniqueIdHelper.isMissing(subscriptionFund.id)) return this.create(subscriptionFund); else return this.update(subscriptionFund);
    }

    public async create(subscriptionFund: SubscriptionFund) {
        subscriptionFund.id = UniqueIdHelper.shortId();
        return DB.query(
            "INSERT INTO subscriptionFunds (id, churchId, subscriptionId, fundId, amount) VALUES (?, ?, ?, ?, ?);",
            [subscriptionFund.id, subscriptionFund.churchId, subscriptionFund.subscriptionId, subscriptionFund.fundId, subscriptionFund.amount]
        ).then(() => { return subscriptionFund; });
    }

    public async update(subscriptionFund: SubscriptionFund) {
        const sql = "UPDATE subscriptionFund SET churchId=?, subscriptionId=?, fundId=?, amount=? WHERE id=? and churchId=?";
        const params = [subscriptionFund.churchId, subscriptionFund.subscriptionId, subscriptionFund.fundId, subscriptionFund.amount];
        await DB.query(sql, params)
        return subscriptionFund;
    }

    public async delete(id: string, churchId: string) {
        DB.query("DELETE FROM subscriptionFunds WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async load(id: string, churchId: string) {
        return DB.queryOne("SELECT * FROM subscriptionFunds WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public loadBySubscriptionId(churchId: string, subscriptionId: string) {
        return DB.query("SELECT * FROM subscriptionFunds WHERE churchId=? AND subscriptionId=?;", [churchId, subscriptionId]);
    }

    public async loadAll(churchId: string) {
        return DB.query("SELECT * FROM subscriptionFunds WHERE churchId=?;", [churchId]);
    }

    public convertToModel(churchId: string, data: any) {
        const result: SubscriptionFund = { id: data.id, churchId, subscriptionId: data.subscriptionId, fundId: data.fundId, amount: data.amount };
        return result;
    }

    public convertAllToModel(churchId: string, data: any[]) {
        const result: any[] = [];
        data.forEach(d => result.push(this.convertToModel(churchId, d)));
        return result;
    }

}
