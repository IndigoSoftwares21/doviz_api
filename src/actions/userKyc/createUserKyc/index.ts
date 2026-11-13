import { withTransaction } from "@/database";
import createPinVerification, { PinVerification } from "@/actions/pinVerification/createPinVerification";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import getKycKeyring from "@/services/kycVault/getKycKeyring";
import sealKyc from "@/services/kycVault/sealKyc";
import bvnIndex from "@/services/kycVault/bvnIndex";
import { KycDetails } from "@/services/kycVault/types";
import selectOpenKycRecords from "./queries/selectOpenKycRecords";
import claimBvn from "./queries/claimBvn";
import insertKycRecord from "./queries/insertKycRecord";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE, { ActionFailure } from "@/constants/actionFailure";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";
import { KYC_LEVEL, KYC_STATUS } from "@/constants/kyc";

interface ICreateUserKyc {
    userId: string;
    details: KycDetails;
    pin: string;
    ipAddress: string | null;
    userAgent: string | null;
}

/**
 * Records a KYC submission: PIN → encrypt everything (never stored or logged
 * in the clear) → claim the BVN for this user → a new `pending` record. Each
 * submission is its own record (history is kept); one can't be made while
 * another is in review, or while already verified at this level. The account
 * provider's BVN match then decides it.
 */
const createUserKyc = async ({ userId, details, pin, ipAddress, userAgent }: ICreateUserKyc) => {
    const { data: verification } = await createPinVerification({ userId, pin, ipAddress, userAgent });
    const result = (failure: ActionFailure | null, recordId: string | null = null) => ({ failure, recordId, verification: verification as PinVerification });
    if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return result(ACTION_FAILURE.PIN);

    const level = KYC_LEVEL.BVN;
    const sealed = sealKyc({ userId, details, keyring: getKycKeyring() });
    const index = bvnIndex({ bvn: details.bvn });

    return withTransaction(async (trx) => {
        const open = await selectOpenKycRecords({ trx, userId });
        if (open.some((record) => record.status === KYC_STATUS.PENDING)) return result(ACTION_FAILURE.KYC_IN_REVIEW);
        if (open.some((record) => record.status === KYC_STATUS.VERIFIED && record.level === level)) return result(ACTION_FAILURE.KYC_ALREADY_VERIFIED);
        if (!(await claimBvn({ trx, userId, bvnIndex: index }))) return result(ACTION_FAILURE.KYC_BVN_IN_USE);

        const record = await insertKycRecord({ trx, userId, sealed, bvnIndex: index, bvnLast4: details.bvn.slice(-4), level });
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.KYC_SUBMITTED,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.KYC_RECORD,
            entityId: record.id,
            ipAddress,
            userAgent,
            metadata: { level },
        });
        return result(null, record.id);
    });
};

export default createUserKyc;
