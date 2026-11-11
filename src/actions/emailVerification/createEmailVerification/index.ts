import { withTransaction } from "@/database";
import AUTH from "@/constants/auth";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import generateOtp from "@/utils/auth/generateOtp";
import hashOtp from "@/utils/auth/hashOtp";
import getEmailOtpSubject from "@/utils/auth/getEmailOtpSubject";
import sendEmail from "@/services/email/sendEmail";
import updateLiveEmailVerifications from "./queries/updateLiveEmailVerifications";
import insertEmailVerification from "./queries/insertEmailVerification";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";
import BRAND from "@/constants/brand";

interface ICreateEmailVerification {
    userId: string;
    email: string;
    requestIp: string | null;
    userAgent: string | null;
}

const createEmailVerification = async ({
    userId,
    email,
    requestIp,
    userAgent,
}: ICreateEmailVerification) => {
    const otp = generateOtp();
    const now = Date.now();

    // Send first, then record — no network call inside the transaction. If
    // sending fails nothing is written and the previous code stays valid.
    await sendEmail({
        to: email,
        subject: `Verify your ${BRAND.NAME} email`,
        text: `Your ${BRAND.NAME} email verification code is ${otp}. It expires in ${AUTH.EMAIL_OTP_TTL_SECONDS / 60} minutes. If you didn't request this, you can ignore this email. Never share this code with anyone, including ${BRAND.NAME} staff.`,
    });

    const data = await withTransaction(async (trx) => {
        await updateLiveEmailVerifications({ trx, userId, revokedAt: new Date(now) });

        const emailVerificationRow = await insertEmailVerification({
            trx,
            userId,
            email,
            codeHash: hashOtp({ subject: getEmailOtpSubject({ userId, email }), otp }),
            maxAttempts: AUTH.EMAIL_OTP_MAX_ATTEMPTS,
            expiresAt: new Date(now + AUTH.EMAIL_OTP_TTL_SECONDS * 1000),
            requestIp,
            userAgent,
        });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.EMAIL_VERIFICATION_REQUESTED,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.EMAIL_VERIFICATION,
            entityId: emailVerificationRow.id,
            ipAddress: requestIp,
            userAgent,
            metadata: { email },
        });

        return {
            email: emailVerificationRow.email,
            expiresAt: emailVerificationRow.expiresAt,
            resendAvailableAt: new Date(
                now + AUTH.EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000,
            ),
        };
    });

    return { data };
};

export default createEmailVerification;
