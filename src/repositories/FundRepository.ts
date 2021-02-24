import { injectable } from "inversify";
import { DB } from "../apiBase/db";
import { Fund } from "../models";
import { UniqueIdHelper } from "../helpers";


@injectable()
export class FundRepository {

    public async getOrCreateGeneral(churchId: string) {
        const data = await DB.queryOne("SELECT * FROM funds WHERE churchId=? AND name='General Fund' AND removed=0;", [churchId]);
        console.log("data");
        console.log(data);
        if (data !== null) return this.convertToModel(churchId, data);
        else {
            const fund: Fund = { churchId, name: "General Fund" };
            await this.save(fund);
            return fund;
        }
    }

    public async save(fund: Fund) {
        if (UniqueIdHelper.isMissing(fund.id)) return this.create(fund); else return this.update(fund);
    }

    public async create(fund: Fund) {
        fund.id = UniqueIdHelper.shortId();
        return DB.query(
            "INSERT INTO funds (id, churchId, name, removed) VALUES (?, ?, ?, 0);",
            [fund.id, fund.churchId, fund.name]
        ).then(() => { return fund; });
    }

    public async update(fund: Fund) {
        return DB.query(
            "UPDATE funds SET name=? WHERE id=? and churchId=?",
            [fund.name, fund.id, fund.churchId]
        ).then(() => { return fund });
    }

    public async delete(churchId: string, id: string) {
        DB.query("UPDATE funds SET removed=0 WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async load(churchId: string, id: string) {
        return DB.queryOne("SELECT * FROM funds WHERE id=? AND churchId=? AND removed=0;", [id, churchId]);
    }

    public async loadAll(churchId: string) {
        return DB.query("SELECT * FROM funds WHERE churchId=? AND removed=0;", [churchId]);
    }

    public convertToModel(churchId: string, data: any) {
        const result: Fund = { id: data.id, name: data.name };
        return result;
    }

    public convertAllToModel(churchId: string, data: any[]) {
        const result: Fund[] = [];
        data.forEach(d => result.push(this.convertToModel(churchId, d)));
        return result;
    }

}
