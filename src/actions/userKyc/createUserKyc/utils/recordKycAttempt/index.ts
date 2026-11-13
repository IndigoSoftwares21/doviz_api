import { Kysely } from "kysely";
import { Database } from "@/database/types";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import fetchCurrentKycFields from "@/actions/kycFields/fetchCurrentKycFields";
import { KycVerification } from "@/services/kycVerification/kycVerifier";
import selectOpenKycRecords from "../../queries/selectOpenKycRecords";
import claimIdentifier from "../../queries/claimIdentifier";
import replaceKycField from "../../queries/replaceKycField";
import insertKycRecord from "../../queries/insertKycRecord";
import decideKycRecord from "../../queries/decideKycRecord";
import releaseUnverifiedClaims from "../../queries/releaseUnverifiedClaims";
import KycRefusal from "../kycRefusal";
import { SealedKycField } from "../sealSubmittedValues";
import ACTION_FAILURE from "@/constants/actionFailure";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";
import { KYC_STATUS } from "@/constants/kyc";
import { KYC_FORMS } from "@/constants/kycFields";

interface IRecordKycAttempt {
    trx: Kysely<Database>;
    userId: string;
    level: string;
    sealed: SealedKycField[];
    decidedBy: string;
    verification: KycVerification;
    audit: { ipAddress: string | null; userAgent: string | null };
}

/**
 * The attempt's one transaction: save what was submitted as new field
 * versions → claim every identifier the attempt relies on (submitted or
 * reused) → the record, linked to the exact field rows checked → the
 * verifier's decision. Throws KycRefusal (rolling everything back) when the
 * user has an attempt in review, is already verified at this level, or an
 * identifier belongs to another user.
 */
const recordKycAttempt = async ({ trx, userId, level, sealed, decidedBy, verification, audit }: IRecordKycAttempt) => {
    const open = await selectOpenKycRecords({ trx, userId });
    if (open.some((record) => record.status === KYC_STATUS.PENDING)) throw new KycRefusal(ACTION_FAILURE.KYC_IN_REVIEW);
    if (open.some((record) => record.status === KYC_STATUS.VERIFIED && record.level === level)) throw new KycRefusal(ACTION_FAILURE.KYC_ALREADY_VERIFIED);

    for (const field of sealed) await replaceKycField({ trx, field });

    const form = KYC_FORMS[level];
    const { data: current } = await fetchCurrentKycFields({ userId, trx });
    const missing = form.required.filter((key) => !current.has(key));
    if (missing.length) throw new Error(`KYC attempt is missing required fields: ${missing.join(", ")}`);
    const linked = [...form.required, ...form.optional].flatMap((key) => (current.has(key) ? [current.get(key)!] : []));

    for (const field of linked) {
        if (field.lookupIndex && !(await claimIdentifier({ trx, userId, fieldKey: field.fieldKey, lookupIndex: field.lookupIndex }))) {
            throw new KycRefusal(ACTION_FAILURE.KYC_IDENTIFIER_IN_USE, field.fieldKey);
        }
    }

    const record = await insertKycRecord({ trx, userId, level, fields: linked.map(({ fieldKey, id }) => ({ fieldKey, id })) });
    await decideKycRecord({ trx, userId, recordId: record.id, decidedBy, verification });
    const verified = verification.outcome === KYC_STATUS.VERIFIED;
    if (!verified) await releaseUnverifiedClaims({ trx, userId });

    const updated = sealed.map((field) => field.fieldKey);
    // Field NAMES and match results only — never values.
    const metadata = { level, decidedBy, updated, reused: linked.map((field) => field.fieldKey).filter((key) => !updated.includes(key)), evidence: verification.evidence };
    await createAuditLog({
        trx,
        action: verified ? AUDIT_ACTIONS.KYC_VERIFIED : AUDIT_ACTIONS.KYC_REJECTED,
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: userId,
        entityType: AUDIT_ENTITY_TYPE.KYC_RECORD,
        entityId: record.id,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
        metadata,
    });
    return { recordId: record.id, verified };
};

export default recordKycAttempt;
