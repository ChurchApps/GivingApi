import { injectable } from "inversify";
import { DB } from "../apiBase/db";
import { PaymentMethod } from "../models/PaymentMethod";

@injectable()
export class PaymentMethodRepository {

    public async save(paymentMethod: PaymentMethod) {
        return this.create(paymentMethod);
    }

    public async create(paymentMethod: PaymentMethod) {
        return DB.query(
            "INSERT INTO paymentMethods (id, churchId, personId, customerId) VALUES (?, ?, ?, ?);",
            [paymentMethod.id, paymentMethod.churchId, paymentMethod.personId, paymentMethod.customerId]
        ).then(() => { return paymentMethod; });
    }

    public async delete(churchId: string, id: string) {
        DB.query("DELETE FROM paymentmethods WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async load(churchId: string, id: string) {
        return DB.queryOne("SELECT * FROM paymentMethods WHERE personId=? AND churchId=?;", [id, churchId]);
    }

    public async loadCustomerId(churchId: string, id: string) {
        return DB.queryOne("SELECT customerId FROM paymentMethods WHERE personId=? AND churchId=?;", [id, churchId]);
    }

    public async loadAll(churchId: string, personId: string) {
        return DB.query("SELECT * FROM paymentMethods WHERE personId=? AND churchId=?;", [personId, churchId]);
    }

    public convertToModel(churchId: string, data: any) {
        const result: PaymentMethod = { id: data.id, churchId, personId: data.personId, customerId: data.customerId };
        return result;
    }

    public convertAllToModel(churchId: string, data: any[]) {
        const result: any[] = [];
        data.forEach(d => result.push(this.convertToModel(churchId, d)));
        return result;
    }

}
