import { db } from "@/database";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import getKycKeyring from "@/services/kycVault/getKycKeyring";
import openKycValue from "@/services/kycVault/openKycValue";
import selectSealedFields from "./queries/selectSealedFields";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

/**
 * Decrypts some of a user's saved field rows, by id — e.g. to send details
 * reused from file to a verifier. Audited (purpose + field names)
 * BEFORE anything is decrypted. In memory only: never log, store or return
 * the result to a client.
 */
const openKycFieldValues = async ({ userId, ids, purpose }: { userId: string; ids: string[]; purpose: string }) => {
    const rows = await selectSealedFields({ userId, ids });
    if (!rows.length) return { data: {} as Record<string, string> };

    await createAuditLog({
        trx: db,
        action: AUDIT_ACTIONS.KYC_DECRYPTED,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        entityType: AUDIT_ENTITY_TYPE.USER,
        entityId: userId,
        metadata: { purpose, fields: rows.map((row) => row.fieldKey) },
    });

    const keyring = getKycKeyring();
    const values: Record<string, string> = {};
    for (const row of rows) values[row.fieldKey] = openKycValue({ userId, fieldKey: row.fieldKey, rowId: row.id, sealed: row, keyring });
    return { data: values };
};

export default openKycFieldValues;
