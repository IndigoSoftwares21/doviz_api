import { db } from "@/database";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import getKycKeyring from "@/services/kycVault/getKycKeyring";
import openKycValue from "@/services/kycVault/openKycValue";
import selectSealedRecordFields from "./queries/selectSealedRecordFields";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

/**
 * THE only way to read KYC in the clear: the exact values a verification
 * attempt checked, by field key. Every call is audited — record, purpose
 * (e.g. "create_bank_account") and which fields — BEFORE anything is
 * decrypted. Keep the result in memory only: never log, store or return it
 * to a client. null = no such record.
 */
const openUserKyc = async ({ recordId, purpose }: { recordId: string; purpose: string }) => {
    const record = await selectSealedRecordFields({ recordId });
    if (!record) return { data: null };

    await createAuditLog({
        trx: db,
        action: AUDIT_ACTIONS.KYC_DECRYPTED,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        entityType: AUDIT_ENTITY_TYPE.KYC_RECORD,
        entityId: recordId,
        metadata: { purpose, userId: record.userId, fields: record.fields.map((field) => field.fieldKey) },
    });

    const keyring = getKycKeyring();
    const values: Record<string, string> = {};
    for (const field of record.fields) {
        values[field.fieldKey] = openKycValue({ userId: record.userId, fieldKey: field.fieldKey, rowId: field.id, sealed: field, keyring });
    }
    return { data: { userId: record.userId, status: record.status, level: record.level, values } };
};

export default openUserKyc;
