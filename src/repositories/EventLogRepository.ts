import { injectable } from "inversify";
import { UniqueIdHelper } from "../apiBase";
import { DB } from "../apiBase/db";
import { EventLog } from "../models";

@injectable()
export class EventLogRepository {

    public async save(eventLog: EventLog) {
        if (UniqueIdHelper.isMissing(eventLog.id)) return this.create(eventLog); else return this.update(eventLog);
    }

    public async create(eventLog: EventLog) {
        return DB.query(
            "INSERT INTO eventLogs (id, churchId, customerId, provider, eventType, message, status, created, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);",
            [eventLog.id, eventLog.churchId, eventLog.customerId, eventLog.provider, eventLog.eventType, eventLog.message, eventLog.status, eventLog.created, false]
        ).then(() => { return eventLog; });
    }

    public async update(eventLog: EventLog) {
        const sql = "UPDATE eventLogs SET resolved=? WHERE id=? and churchId=?";
        const params = [eventLog.resolved, eventLog.id, eventLog.churchId];
        await DB.query(sql, params);
        return eventLog;
    }

    public async delete(churchId: string, id: string) {
        DB.query("DELETE FROM eventLogs WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async load(churchId: string, id: string) {
        return DB.queryOne("SELECT * FROM eventLogs WHERE id=? AND churchId=?;", [id, churchId]);
    }

    public async loadByType(churchId: string, status: string) {
        return DB.query("SELECT eventLogs.*, personId FROM customers LEFT JOIN eventLogs ON customers.id = eventLogs.customerId WHERE eventLogs.status=? AND eventLogs.churchId=? ORDER BY eventLogs.resolved ASC;", [status, churchId]);
    }

    public async loadAll(churchId: string) {
        return DB.query("SELECT * FROM eventLogs WHERE churchId=?;", [churchId]);
    }

    public convertToModel(data: any) {
        const result: EventLog = { ...data };
        return result;
    }

    public convertAllToModel(data: any[]) {
        const result: EventLog[] = [];
        data.forEach(d => result.push(this.convertToModel(d)));
        return result;
    }

}
