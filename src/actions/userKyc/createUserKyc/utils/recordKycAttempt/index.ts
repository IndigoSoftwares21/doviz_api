import { Kysely } from "kysely";
import { Database } from "@/database/types";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import fetchCurrentKycFields from "@/actions/kycFields/fetchCurrentKycFields";
import selectOpenKycRecords from "../../queries/selectOpenKycRecords";
import claimIdentifier from "../../queries/claimIdentifier";
import replaceKycField from "../../queries/replaceKycField";
import insertKycRecord from "../../queries/insertKycRecord";
import KycRefusal from "../kycRefusal";
import { SealedKycField } from "../sealSubmittedValues";
import ACTION_FAILURE from "@/constants/actionFailure";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";
import { KYC_STATUS } from "@/constants/kyc";
import { KYC_FORMS } from "@/constants/kycFields";

/**
 * The submission's one transaction. Throws KycRefusal (rolling everything
 * back) when the user has an attempt in review, is already verified at this
 * level, or submits an identifier another user holds.
 */
const recordKycAttempt = async ({
    trx,
    userId,
    level,
    sealed,
    audit,
}: {
    trx: Kysely<Database>;
    userId: string;
    level: string;
    sealed: SealedKycField[];
    audit: { ipAddress: string | null; userAgent: string | null };
}) => {
    const open = await selectOpenKycRecords({ trx, userId });
    if (open.some((record) => record.status === KYC_STATUS.PENDING)) throw new KycRefusal(ACTION_FAILURE.KYC_IN_REVIEW);
    if (open.some((record) => record.status === KYC_STATUS.VERIFIED && record.level === level)) throw new KycRefusal(ACTION_FAILURE.KYC_ALREADY_VERIFIED);

    for (const field of sealed) {
        if (field.lookupIndex && !(await claimIdentifier({ trx, userId, fieldKey: field.fieldKey, lookupIndex: field.lookupIndex }))) {
            throw new KycRefusal(ACTION_FAILURE.KYC_IDENTIFIER_IN_USE, field.fieldKey);
        }
    }
    for (const field of sealed) await replaceKycField({ trx, field });

    // Link the CURRENT value of every field the level asks for: just submitted, or reused from file.
    const form = KYC_FORMS[level];
    const { data: current } = await fetchCurrentKycFields({ userId, trx });
    const missing = form.required.filter((key) => !current.has(key));
    if (missing.length) throw new Error(`KYC submission is missing required fields: ${missing.join(", ")}`);
    const linked = [...form.required, ...form.optional].flatMap((key) => {
        const row = current.get(key);
        return row ? [{ fieldKey: key, id: row.id }] : [];
    });

    const record = await insertKycRecord({ trx, userId, level, fields: linked });
    const updated = sealed.map((field) => field.fieldKey);
    await createAuditLog({
        trx,
        action: AUDIT_ACTIONS.KYC_SUBMITTED,
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: userId,
        entityType: AUDIT_ENTITY_TYPE.KYC_RECORD,
        entityId: record.id,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
        // Field NAMES only — never values.
        metadata: { level, updated, reused: linked.map((field) => field.fieldKey).filter((key) => !updated.includes(key)) },
    });
    return record;
};

export default recordKycAttempt;
