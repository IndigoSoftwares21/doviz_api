import { withTransaction } from "@/database";
import AUTH from "@/constants/auth";
import AUDIT_ACTIONS from "@/constants/auditActions";
import CODE_FAILURE_REASON from "@/constants/codeFailureReason";
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
import auditPinResetFailure from "./utils/auditPinResetFailure";
import { AUDIT_ACTOR_TYPE } from "@/constants/auditTargets";

interface ICreatePinReset {
    userId: string;
    otp: string;
    newPin: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Resets the PIN via an SMS code; clears any PIN lock and revokes every
// biometric key (a forgotten PIN can mean a compromised device). Returns
// { data: null } for any code failure; failed attempts are committed.
const createPinReset = async ({ userId, otp, newPin, ipAddress, userAgent }: ICreatePinReset) => {
    // Hashed before locking: bcrypt is slow by design (~250ms).
    const pinHash = await hashPin({ userId, pin: newPin });

    const data = await withTransaction(async (trx) => {
        const now = new Date();
        const purpose = AUTH.OTP_PURPOSE_PIN_RESET;

        const user = await selectUserPhoneForReset({ trx, userId });
        const subject = getPhoneOtpSubject({ phoneNumber: user.phoneNumber, purpose });

        const otpRow = await selectLiveOtp({ trx, phoneNumber: user.phoneNumber, purpose, now });

        if (!otpRow) {
            // Same work as a real check, so timing doesn't reveal a live code.
            hashOtp({ subject, otp });
            await auditPinResetFailure({
                trx, userId, otpId: null, reason: CODE_FAILURE_REASON.NO_LIVE_OTP, ipAddress, userAgent,
            });
            return null;
        }

        if (!verifyOtpHash({ subject, otp, codeHash: otpRow.codeHash })) {
            const attempts = otpRow.attempts + 1;
            const revokedAt = attempts >= otpRow.maxAttempts ? now : null;

            await updateOtpAttempts({ trx, id: otpRow.id, attempts, revokedAt });
            await auditPinResetFailure({
                trx, userId, otpId: otpRow.id, reason: CODE_FAILURE_REASON.INVALID_CODE, attempts, ipAddress, userAgent,
            });
            return null;
        }

        await updateOtpConsumed({ trx, id: otpRow.id, consumedAt: now });
        await updatePinHash({ trx, userId, pinHash, updatedAt: now });

        const revokedKeys = await updateBiometricKeysRevoked({ trx, userId, revokedAt: now });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.PIN_RESET,
            actorType: AUDIT_ACTOR_TYPE.USER,
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
