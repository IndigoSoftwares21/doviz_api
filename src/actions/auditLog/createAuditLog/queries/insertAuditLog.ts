import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertAuditLog {
    trx: Kysely<Database>;
    actorType: string;
    actorId: string | null;
    action: string;
    entityType: string | null;
    entityId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: Record<string, unknown>;
}

const insertAuditLog = async ({
    trx,
    actorType,
    actorId,
    action,
    entityType,
    entityId,
    ipAddress,
    userAgent,
    metadata,
}: IInsertAuditLog) => {
    const auditLogRow = await trx
        .insertInto("audit_logs")
        .values({
            actorType,
            actorId,
            action,
            entityType,
            entityId,
            ipAddress,
            userAgent,
            metadata: JSON.stringify(metadata),
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return auditLogRow;
};

export default insertAuditLog;
