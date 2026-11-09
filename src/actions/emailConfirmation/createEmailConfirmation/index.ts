import { withTransaction } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import hashOtp from "@/utils/auth/hashOtp";
import verifyOtpHash from "@/utils/auth/verifyOtpHash";
import getEmailOtpSubject from "@/utils/auth/getEmailOtpSubject";
import selectLiveEmailVerification from "./queries/selectLiveEmailVerification";
import updateEmailVerificationAttempts from "./queries/updateEmailVerificationAttempts";
import updateEmailVerificationConsumed from "./queries/updateEmailVerificationConsumed";
import updateUserEmail from "./queries/updateUserEmail";
import CODE_FAILURE_REASON from "@/constants/codeFailureReason";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

interface ICreateEmailConfirmation {
    userId: string;
    otp: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Returns { data: null } for every failure; the reason goes to the audit
// log. Failed attempts are committed, not rolled back.
const createEmailConfirmation = async ({
    userId,
    otp,
    ipAddress,
    userAgent,
}: ICreateEmailConfirmation) => {
    const data = await withTransaction(async (trx) => {
        const now = new Date();

        const verificationRow = await selectLiveEmailVerification({ trx, userId, now });

        if (!verificationRow) {
            hashOtp({ subject: getEmailOtpSubject({ userId, email: "" }), otp });

            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED,
                actorType: AUDIT_ACTOR_TYPE.USER,
                actorId: userId,
                ipAddress,
                userAgent,
                metadata: { reason: CODE_FAILURE_REASON.NO_LIVE_CODE },
            });

            return null;
        }

        const isValid = verifyOtpHash({
            subject: getEmailOtpSubject({ userId, email: verificationRow.email }),
            otp,
            codeHash: verificationRow.codeHash,
        });

        if (!isValid) {
            const attempts = verificationRow.attempts + 1;
            const isLocked = attempts >= verificationRow.maxAttempts;

            await updateEmailVerificationAttempts({
                trx,
                id: verificationRow.id,
                attempts,
                revokedAt: isLocked ? now : null,
            });

            await createAuditLog({
                trx,
                action: isLocked
                    ? AUDIT_ACTIONS.EMAIL_VERIFICATION_LOCKED
                    : AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED,
                actorType: AUDIT_ACTOR_TYPE.USER,
                actorId: userId,
                entityType: AUDIT_ENTITY_TYPE.EMAIL_VERIFICATION,
                entityId: verificationRow.id,
                ipAddress,
                userAgent,
                metadata: { email: verificationRow.email, reason: CODE_FAILURE_REASON.INVALID_CODE, attempts },
            });

            return null;
        }

        await updateEmailVerificationConsumed({ trx, id: verificationRow.id, consumedAt: now });

        const user = await updateUserEmail({
            trx,
            userId,
            email: verificationRow.email,
            emailVerifiedAt: now,
        });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.EMAIL_VERIFIED,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.USER,
            entityId: userId,
            ipAddress,
            userAgent,
            metadata: { email: verificationRow.email },
        });

        return user;
    });

    return { data };
};

export default createEmailConfirmation;
