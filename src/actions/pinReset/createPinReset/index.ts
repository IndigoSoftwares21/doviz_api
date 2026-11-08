import { withTransaction } from "@/database";
import AUTH from "@/constants/auth";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import hashOtp from "@/utils/auth/hashOtp";
import hashPin from "@/utils/auth/hashPin";
import verifyOtpHash from "@/utils/auth/verifyOtpHash";
import getPhoneOtpSubject from "@/utils/auth/getPhoneOtpSubject";
import selectLiveOtp from "@/actions/login/createLogin/queries/selectLiveOtp";
import updateOtpAttempts from "@/actions/login/createLogin/queries/updateOtpAttempts";
import updateOtpConsumed from "@/actions/login/createLogin/queries/updateOtpConsumed";
import updatePinHash from "@/actions/pin/modifyPin/queries/updatePinHash";
import selectUserPhoneForReset from "./queries/selectUserPhoneForReset";
import updateBiometricKeysRevoked from "./queries/updateBiometricKeysRevoked";

interface ICreatePinReset {
    userId: string;
    otp: string;
    newPin: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Resets the PIN with an SMS code sent to the account's phone. Also clears
// any PIN lock and revokes every biometric key — a forgotten PIN can mean a
// compromised device, so biometrics must be re-enrolled. Returns
// { data: null } for any code failure; failed attempts are committed.
const createPinReset = async ({ userId, otp, newPin, ipAddress, userAgent }: ICreatePinReset) => {
    const data = await withTransaction(async (trx) => {
        const now = new Date();
        const purpose = AUTH.OTP_PURPOSE_PIN_RESET;

        const user = await selectUserPhoneForReset({ trx, userId });
        const subject = getPhoneOtpSubject({ phoneNumber: user.phoneNumber, purpose });

        const otpRow = await selectLiveOtp({ trx, phoneNumber: user.phoneNumber, purpose, now });

        if (!otpRow) {
            hashOtp({ subject, otp });

            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.PIN_RESET_FAILED,
                actorType: "user",
                actorId: userId,
                ipAddress,
                userAgent,
                metadata: { reason: "no_live_otp" },
            });

            return null;
        }

        if (!verifyOtpHash({ subject, otp, codeHash: otpRow.codeHash })) {
            const attempts = otpRow.attempts + 1;

            await updateOtpAttempts({
                trx,
                id: otpRow.id,
                attempts,
                revokedAt: attempts >= otpRow.maxAttempts ? now : null,
            });

            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.PIN_RESET_FAILED,
                actorType: "user",
                actorId: userId,
                entityType: "phone_otp",
                entityId: otpRow.id,
                ipAddress,
                userAgent,
                metadata: { reason: "invalid_code", attempts },
            });

            return null;
        }

        await updateOtpConsumed({ trx, id: otpRow.id, consumedAt: now });

        const pinHash = await hashPin({ userId, pin: newPin });
        await updatePinHash({ trx, userId, pinHash, updatedAt: now });

        const revokedKeys = await updateBiometricKeysRevoked({ trx, userId, revokedAt: now });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.PIN_RESET,
            actorType: "user",
            actorId: userId,
            ipAddress,
            userAgent,
            metadata: { biometricDevicesRevoked: revokedKeys.map((key) => key.deviceId) },
        });

        return { pinResetAt: now, biometricDevicesRevoked: revokedKeys.length };
    });

    return { data };
};

export default createPinReset;
