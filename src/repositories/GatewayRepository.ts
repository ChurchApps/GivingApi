import { injectable } from "inversify";
import { DB } from "../apiBase/db";
import { Gateway } from "../models";
import { UniqueIdHelper } from "../helpers";


@injectable()
export class GatewayRepository {

    public async save(gateway: Gateway) {
        if (UniqueIdHelper.isMissing(gateway.id)) return this.create(gateway); else return this.update(gateway);
    }

    public async create(gateway: Gateway) {
        gateway.id = UniqueIdHelper.shortId();
        DB.query("DELETE FROM gateways WHERE churchId=? AND id<>?;", [gateway.churchId, gateway.id]);  // enforce a single record per church (for now)
        return DB.query(
            "INSERT INTO gateways (id, churchId, provider, publicKey, privateKey) VALUES (?, ?, ?, ?, ?);",
            [gateway.id, gateway.churchId, gateway.provider, gateway.publicKey, gateway.privateKey]
        ).then(() => { return gateway; });
    }

    public async update(gateway: Gateway) {
        return DB.query(
            "UPDATE gateways SET provider=?, publicKey=?, privateKey=? WHERE id=? and churchId=?",
            [gateway.provider, gateway.publicKey, gateway.privateKey, gateway.id, gateway.churchId]
        ).then(() => { return gateway });
    }

    public async delete(churchId: string, id: string) {
        DB.query("DELETE FROM gateways WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async loadChurchProvider(churchId: string, provider: string) {
        return DB.query("SELECT * FROM gateways WHERE churchId=? AND provider=?;", [churchId, provider]);
    }

    public async load(churchId: string, id: string) {
        return DB.queryOne("SELECT * FROM gateways WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async loadAll(churchId: string) {
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
