import { db } from "@/database";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import getKycKeyring from "@/services/kycVault/getKycKeyring";
import openKyc from "@/services/kycVault/openKyc";
import selectSealedKycRecord from "./queries/selectSealedKycRecord";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

/**
 * THE only way to read KYC in the clear. Every call is audited — record and
 * purpose (e.g. "create_bank_account") — BEFORE anything is decrypted, so no
 * read goes unrecorded. Keep the result in memory only: never log, store or
 * return it to a client. null = no such record.
 */
const openUserKyc = async ({ recordId, purpose }: { recordId: string; purpose: string }) => {
    const sealed = await selectSealedKycRecord({ recordId });
    if (!sealed) return { data: null };

    await createAuditLog({
        trx: db,
        action: AUDIT_ACTIONS.KYC_DECRYPTED,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        entityType: AUDIT_ENTITY_TYPE.KYC_RECORD,
        entityId: recordId,
        metadata: { purpose, userId: sealed.userId },
    });

    const { userId, status, ...columns } = sealed;
    return { data: { userId, status, details: openKyc({ userId, sealed: columns, keyring: getKycKeyring() }) } };
};

export default openUserKyc;
