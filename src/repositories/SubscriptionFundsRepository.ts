import { injectable } from "inversify";
import { DB, UniqueIdHelper } from "@churchapps/apihelper";
import { SubscriptionFund } from "../models";
import { Repositories } from "./Repositories";

@injectable()
export class SubscriptionFundsRepository {

    public async save(subscriptionFund: SubscriptionFund) {
        return subscriptionFund.id ? this.update(subscriptionFund) : this.create(subscriptionFund);
    }

    private async create(subscriptionFund: SubscriptionFund) {
        subscriptionFund.id = UniqueIdHelper.shortId();
        return DB.query(
            "INSERT INTO subscriptionFunds (id, churchId, subscriptionId, fundId, amount) VALUES (?, ?, ?, ?, ?);",
            [subscriptionFund.id, subscriptionFund.churchId, subscriptionFund.subscriptionId, subscriptionFund.fundId, subscriptionFund.amount]
        ).then(() => { return subscriptionFund; });
    }

    private async update(subscriptionFund: SubscriptionFund) {
        const sql = "UPDATE subscriptionFund SET churchId=?, subscriptionId=?, fundId=?, amount=? WHERE id=? and churchId=?";
        const params = [subscriptionFund.churchId, subscriptionFund.subscriptionId, subscriptionFund.fundId, subscriptionFund.amount];
        await DB.query(sql, params)
        return subscriptionFund;
    }

    public async delete(id: string, churchId: string) {
        DB.query("DELETE FROM subscriptionFunds WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async deleteBySubscriptionId(churchId: string, subscriptionId: string) {
        DB.query("DELETE FROM subscriptionFunds WHERE subscriptionId=? AND churchId=?;", [subscriptionId, churchId]);
    }

    public async load(id: string, churchId: string) {
        return DB.queryOne("SELECT * FROM subscriptionFunds WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public loadBySubscriptionId(churchId: string, subscriptionId: string) {
        const sql = "SELECT subscriptionFunds.*, funds.name FROM subscriptionFunds"
            + " LEFT JOIN funds ON subscriptionFunds.fundId = funds.id"
            + " WHERE subscriptionFunds.churchId=? AND subscriptionFunds.subscriptionId=?";
        return DB.query(sql, [churchId, subscriptionId]);
    }

    //If the fund gets deleted for a recurring donation, the donations will go to '(General Fund)'
    public async loadForSubscriptionLog(churchId: string, subscriptionId: string) {
        let result;
        const sql = "SELECT subscriptionFunds.*, funds.name, funds.removed FROM subscriptionFunds"
            + " LEFT JOIN funds ON subscriptionFunds.fundId = funds.id"
            + " WHERE subscriptionFunds.churchId=? AND subscriptionFunds.subscriptionId=?";
        const subscriptionFund = await DB.query(sql, [churchId, subscriptionId]);
        if (subscriptionFund && subscriptionFund[0].removed === false) {
            const { removed, ...sf } = subscriptionFund[0];
            result = [sf];
        } else {
            const generalFund = await Repositories.getCurrent().fund.getOrCreateGeneral(churchId);
            const { removed, ...sf } = subscriptionFund[0];
            sf.fundId = generalFund.id;
            sf.name = generalFund.name;
            result = [sf];
        }
        return result;
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
