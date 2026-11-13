import { withTransaction } from "@/database";
import createPinVerification, { PinVerification } from "@/actions/pinVerification/createPinVerification";
import sealSubmittedValues from "./utils/sealSubmittedValues";
import recordKycAttempt from "./utils/recordKycAttempt";
import KycRefusal from "./utils/kycRefusal";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE, { ActionFailure } from "@/constants/actionFailure";

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
 * Starts a verification attempt: PIN → encrypt what was submitted (never
 * stored or logged in the clear) → save each value as a new field version,
 * identifiers claimed for this user → a `pending` record linked to the current
 * value of every field the level asks for, so data already on file is reused,
 * not re-asked. A KYC verifier then decides it.
 */
const createUserKyc = async ({ userId, level, values, pin, ipAddress, userAgent }: ICreateUserKyc) => {
    const { data: verification } = await createPinVerification({ userId, pin, ipAddress, userAgent });
    const result = (failure: ActionFailure | null, recordId: string | null = null, fieldKey: string | null = null) => ({
        failure,
        recordId,
        fieldKey,
        verification: verification as PinVerification,
    });
    if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return result(ACTION_FAILURE.PIN);

    const sealed = sealSubmittedValues({ userId, values });
    try {
        const record = await withTransaction((trx) => recordKycAttempt({ trx, userId, level, sealed, audit: { ipAddress, userAgent } }));
        return result(null, record.id);
    } catch (error) {
        if (error instanceof KycRefusal) return result(error.failure, null, error.fieldKey);
        throw error;
    }
};

export default createUserKyc;
