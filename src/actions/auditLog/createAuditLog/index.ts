import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { AuditAction } from "@/constants/auditActions";
import insertAuditLog from "./queries/insertAuditLog";

interface ICreateAuditLog {
    trx: Kysely<Database>;
    action: AuditAction;
    actorType: "anonymous" | "user" | "admin" | "system";
    actorId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
}

// Always pass the caller's transaction so the audit row commits (or rolls
// back) atomically with the event it records. Never put OTPs, PINs, tokens
// or secrets in metadata.
const createAuditLog = async ({
    trx,
    action,
    actorType,
    actorId = null,
    entityType = null,
    entityId = null,
    ipAddress = null,
    userAgent = null,
    metadata = {},
}: ICreateAuditLog) => {
    const data = await insertAuditLog({
        trx,
        actorType,
        actorId,
        action,
        entityType,
        entityId,
        ipAddress,
        userAgent,
        metadata,
    });

    return { data };
};

export default createAuditLog;
