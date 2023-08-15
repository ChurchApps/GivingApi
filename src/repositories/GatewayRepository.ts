import { injectable } from "inversify";
import { DB } from "../apiBase/db";
import { Gateway } from "../models";
import { UniqueIdHelper } from "../helpers";


@injectable()
export class GatewayRepository {

    public save(gateway: Gateway) {
        return gateway.id ? this.update(gateway) : this.create(gateway);
    }

    private async create(gateway: Gateway) {
        gateway.id = UniqueIdHelper.shortId();
        await DB.query("DELETE FROM gateways WHERE churchId=? AND id<>?;", [gateway.churchId, gateway.id]);  // enforce a single record per church (for now)
        const sql = "INSERT INTO gateways (id, churchId, provider, publicKey, privateKey, webhookKey, productId, payFees) VALUES (?, ?, ?, ?, ?, ?, ?, ?);";
        const params = [gateway.id, gateway.churchId, gateway.provider, gateway.publicKey, gateway.privateKey, gateway.webhookKey, gateway.productId, gateway.payFees];
        await DB.query(sql, params);
        return gateway;
    }

    private async update(gateway: Gateway) {
        const sql = "UPDATE gateways SET provider=?, publicKey=?, privateKey=?, webhookKey=?, productId=?, payFees=? WHERE id=? and churchId=?";
        const params = [gateway.provider, gateway.publicKey, gateway.privateKey, gateway.webhookKey, gateway.productId, gateway.payFees, gateway.id, gateway.churchId];
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
        const result: Gateway = { id: data.id, provider: data.provider, publicKey: data.publicKey, webhookKey: data.webhookKey, productId: data.productId, payFees: data.payFees };
        return result;
    }

    public convertAllToModel(churchId: string, data: any[]) {
        const result: Gateway[] = [];
        data.forEach(d => result.push(this.convertToModel(churchId, d)));
        return result;
    }

}
