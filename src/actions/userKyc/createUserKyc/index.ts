import { withTransaction } from "@/database";
import createPinVerification, { PinVerification } from "@/actions/pinVerification/createPinVerification";
import fetchVerifiedKycFields from "@/actions/kycFields/fetchVerifiedKycFields";
import openKycFieldValues from "@/actions/kycFields/openKycFieldValues";
import getKycVerifier from "@/services/kycVerification/getKycVerifier";
import { KYC_OUTCOME } from "@/services/kycVerification/kycVerifier";
import monitoring from "@/utils/monitoring";
import sealSubmittedValues from "./utils/sealSubmittedValues";
import storeFileValues, { removeUploads } from "./utils/storeFileValues";
import precheckKycAttempt from "./utils/precheckKycAttempt";
import selectUserPhone from "./queries/selectUserPhone";
import recordKycAttempt from "./utils/recordKycAttempt";
import KycRefusal from "./utils/kycRefusal";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE, { ActionFailure } from "@/constants/actionFailure";
import { KYC_FIELDS, KYC_FORMS } from "@/constants/kycFields";

interface ICreateUserKyc {
    userId: string;
    level: string;
    /** Validated, normalised values — only the fields the user filled in. */
    values: Record<string, string>;
    pin: string;
    ipAddress: string | null;
    userAgent: string | null;
}

/**
 * One verification attempt, decided on the spot: PIN → refusals we can see
 * before paying → store file evidence (encrypted) → the verifier checks the
 * submitted values plus those reused from file → record the attempt, its
 * fields and the decision in one transaction. If the verifier can't answer,
 * nothing is recorded and the uploads are removed.
 */
const createUserKyc = async ({ userId, level, values, pin, ipAddress, userAgent }: ICreateUserKyc) => {
    const { data: verification } = await createPinVerification({ userId, pin, ipAddress, userAgent });
    const result = (failure: ActionFailure | null, extra: { recordId?: string; fieldKey?: string | null } = {}) => ({
        failure, recordId: extra.recordId ?? null, fieldKey: extra.fieldKey ?? null, verification: verification as PinVerification,
    });
    if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return result(ACTION_FAILURE.PIN);

    const blocked = await precheckKycAttempt({ userId, level, values });
    if (blocked.failure) return result(blocked.failure, { fieldKey: blocked.fieldKey });

    const form = KYC_FORMS[level];
    const { data: onFile } = await fetchVerifiedKycFields({ userId });
    const reused = [...form.required, ...form.optional].filter((key) => !(key in values) && !KYC_FIELDS[key].fresh && onFile.has(key));
    const { data: fromFile } = await openKycFieldValues({ userId, ids: reused.map((key) => onFile.get(key)!.id), purpose: "verify_kyc" });

    let stored: Awaited<ReturnType<typeof storeFileValues>>;
    try {
        stored = await storeFileValues({ userId, values });
    } catch (error) {
        monitoring.error("KYC evidence couldn't be stored — not verifying", error as Error);
        return result(ACTION_FAILURE.PROVIDER_UNAVAILABLE);
    }

    const verifier = getKycVerifier();
    const decision = await verifier.verify({ level, values: { ...fromFile, ...values }, contact: { phoneNumber: await selectUserPhone({ userId }) } });
    if (decision.outcome === KYC_OUTCOME.UNAVAILABLE) {
        await removeUploads(stored.uploads);
        return result(ACTION_FAILURE.PROVIDER_UNAVAILABLE);
    }

    try {
        const sealed = sealSubmittedValues({ userId, values: stored.stored });
        const attempt = await withTransaction((trx) =>
            recordKycAttempt({ trx, userId, level, sealed, decidedBy: verifier.name, verification: decision, audit: { ipAddress, userAgent } }),
        );
        return result(null, { recordId: attempt.recordId });
    } catch (error) {
        await removeUploads(stored.uploads);
        if (error instanceof KycRefusal) return result(error.failure, { fieldKey: error.fieldKey });
        throw error;
    }
};

export default createUserKyc;
