import { withTransaction } from "@/database";
import AUTH from "@/constants/auth";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import generateOtp from "@/utils/auth/generateOtp";
import hashOtp from "@/utils/auth/hashOtp";
import getPhoneOtpSubject from "@/utils/auth/getPhoneOtpSubject";
import sendSms from "@/services/sms/sendSms";
import updateLiveOtps from "./queries/updateLiveOtps";
import insertOtp from "./queries/insertOtp";

interface ICreateOtp {
    phoneNumber: string;
    purpose: typeof AUTH.OTP_PURPOSE_LOGIN | typeof AUTH.OTP_PURPOSE_PIN_RESET;
    actorId?: string | null;
    requestIp: string | null;
    userAgent: string | null;
}

const SMS_ACTION: Record<ICreateOtp["purpose"], string> = {
    login: "verification code",
    pin_reset: "PIN reset code",
};

const createOtp = async ({
    phoneNumber,
    purpose,
    actorId = null,
    requestIp,
    userAgent,
}: ICreateOtp) => {
    const otp = generateOtp();
    const now = Date.now();

    // SMS is sent inside the transaction: if delivery fails, the new OTP is
    // rolled back and the previous one is not revoked.
    const data = await withTransaction(async (trx) => {
        await updateLiveOtps({
            trx,
            phoneNumber,
            purpose,
            revokedAt: new Date(now),
        });

        const otpRow = await insertOtp({
            trx,
            phoneNumber,
            purpose,
            codeHash: hashOtp({ subject: getPhoneOtpSubject({ phoneNumber, purpose }), otp }),
            maxAttempts: AUTH.OTP_MAX_ATTEMPTS,
            expiresAt: new Date(now + AUTH.OTP_TTL_SECONDS * 1000),
            requestIp,
            userAgent,
        });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.OTP_REQUESTED,
            actorType: actorId ? "user" : "anonymous",
            actorId,
            entityType: "phone_otp",
            entityId: otpRow.id,
            ipAddress: requestIp,
            userAgent,
            metadata: { phoneNumber, purpose },
        });

        await sendSms({
            to: phoneNumber,
            message: `Your Doviz ${SMS_ACTION[purpose]} is ${otp}. It expires in ${AUTH.OTP_TTL_SECONDS / 60} minutes. Never share this code with anyone, including Doviz staff.`,
        });

        return {
            expiresAt: otpRow.expiresAt,
            resendAvailableAt: new Date(
                now + AUTH.OTP_RESEND_COOLDOWN_SECONDS * 1000,
            ),
        };
    });

    return { data };
};

export default createOtp;
