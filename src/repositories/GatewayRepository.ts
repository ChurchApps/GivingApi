import { injectable } from "inversify";
import { DB } from "../apiBase/db";
import { Gateway } from "../models";
import { UniqueIdHelper } from "../helpers";


@injectable()
export class GatewayRepository {

    public save(gateway: Gateway) {
        if (UniqueIdHelper.isMissing(gateway.id)) return this.create(gateway); else return this.update(gateway);
    }

    public async create(gateway: Gateway) {
        gateway.id = UniqueIdHelper.shortId();
        await DB.query("DELETE FROM gateways WHERE churchId=? AND id<>?;", [gateway.churchId, gateway.id]);  // enforce a single record per church (for now)
        const sql = "INSERT INTO gateways (id, churchId, provider, publicKey, privateKey) VALUES (?, ?, ?, ?, ?);";
        const params = [gateway.id, gateway.churchId, gateway.provider, gateway.publicKey, gateway.privateKey];
        await DB.query(sql, params);
        return gateway;
    }

    public async update(gateway: Gateway) {
        const sql = "UPDATE gateways SET provider=?, publicKey=?, privateKey=? WHERE id=? and churchId=?";
        const params = [gateway.provider, gateway.publicKey, gateway.privateKey, gateway.id, gateway.churchId];
        await DB.query(sql, params);
        return gateway;
    }

    public delete(churchId: string, id: string) {
        return DB.query("DELETE FROM gateways WHERE id=? AND churchId=?;", [id, churchId]);
    }


    public load(churchId: string, id: string) {
        return DB.queryOne("SELECT * FROM gateways WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public loadAll(churchId: string) {
        return DB.query("SELECT * FROM gateways WHERE churchId=?;", [churchId]);
    }

    public convertToModel(churchId: string, data: any) {
        const result: Gateway = { id: data.id, provider: data.provider, publicKey: data.publicKey };
        return result;
    }

    public convertAllToModel(churchId: string, data: any[]) {
        const result: Gateway[] = [];
        data.forEach(d => result.push(this.convertToModel(churchId, d)));
        return result;
    }

}
