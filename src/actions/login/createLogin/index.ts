import { withTransaction } from "@/database";
import AUTH from "@/constants/auth";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import hashOtp from "@/utils/auth/hashOtp";
import verifyOtpHash from "@/utils/auth/verifyOtpHash";
import generateRefreshToken from "@/utils/auth/generateRefreshToken";
import hashToken from "@/utils/auth/hashToken";
import signAccessToken from "@/utils/auth/signAccessToken";
import selectLiveOtp from "./queries/selectLiveOtp";
import updateOtpAttempts from "./queries/updateOtpAttempts";
import updateOtpConsumed from "./queries/updateOtpConsumed";
import insertUser from "./queries/insertUser";
import insertSession from "./queries/insertSession";
import insertUserDevice from "./queries/insertUserDevice";
import updateDeviceSessionsRevoked from "./queries/updateDeviceSessionsRevoked";
import insertRefreshToken from "./queries/insertRefreshToken";

interface ICreateLogin {
    phoneNumber: string;
    otp: string;
    deviceId: string;
    deviceName: string | null;
    platform: string | null;
    ipAddress: string | null;
    userAgent: string | null;
}

// Returns { data: null } for every failure (no OTP, expired, wrong code,
// locked out) so callers can't tell the cases apart — the real reason only
// goes to the audit log. Failed attempts are committed, not rolled back.
const createLogin = async ({
    phoneNumber,
    otp,
    deviceId,
    deviceName,
    platform,
    ipAddress,
    userAgent,
}: ICreateLogin) => {
    const data = await withTransaction(async (trx) => {
        const now = new Date();

        const otpRow = await selectLiveOtp({
            trx,
            phoneNumber,
            purpose: AUTH.OTP_PURPOSE_LOGIN,
            now,
        });

        if (!otpRow) {
            // Do the same HMAC work as a real check to blunt timing probes
            // for whether a live OTP exists.
            hashOtp({ subject: phoneNumber, otp });

            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.LOGIN_FAILED,
                actorType: "anonymous",
                ipAddress,
                userAgent,
                metadata: { phoneNumber, reason: "no_live_otp" },
            });

            return null;
        }

        const isValid = verifyOtpHash({
            subject: phoneNumber,
            otp,
            codeHash: otpRow.codeHash,
        });

        if (!isValid) {
            const attempts = otpRow.attempts + 1;
            const isLocked = attempts >= otpRow.maxAttempts;

            await updateOtpAttempts({
                trx,
                id: otpRow.id,
                attempts,
                revokedAt: isLocked ? now : null,
            });

            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.LOGIN_FAILED,
                actorType: "anonymous",
                entityType: "phone_otp",
                entityId: otpRow.id,
                ipAddress,
                userAgent,
                metadata: { phoneNumber, reason: "invalid_code", attempts },
            });

            if (isLocked) {
                await createAuditLog({
                    trx,
                    action: AUDIT_ACTIONS.OTP_LOCKED,
                    actorType: "anonymous",
                    entityType: "phone_otp",
                    entityId: otpRow.id,
                    ipAddress,
                    userAgent,
                    metadata: { phoneNumber },
                });
            }

            return null;
        }

        await updateOtpConsumed({ trx, id: otpRow.id, consumedAt: now });

        const user = await insertUser({ trx, phoneNumber, loggedInAt: now });

        if (user.isNewUser) {
            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.USER_REGISTERED,
                actorType: "user",
                actorId: user.id,
                entityType: "user",
                entityId: user.id,
                ipAddress,
                userAgent,
                metadata: { phoneNumber },
            });
        }

        // An SMS login trusts this device and replaces any session it had.
        const device = await insertUserDevice({
            trx,
            userId: user.id,
            deviceId,
            deviceName,
            platform,
            lastIp: ipAddress,
            trustedAt: now,
        });

        await updateDeviceSessionsRevoked({
            trx,
            userDeviceId: device.id,
            revokedAt: now,
            revokedReason: "replaced_by_login",
        });

        if (device.isNewDevice) {
            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.DEVICE_TRUSTED,
                actorType: "user",
                actorId: user.id,
                entityType: "user_device",
                entityId: device.id,
                ipAddress,
                userAgent,
                metadata: { deviceId, deviceName, platform },
            });
        }

        const session = await insertSession({
            trx,
            userId: user.id,
            userDeviceId: device.id,
            ipAddress,
            userAgent,
            expiresAt: new Date(now.getTime() + AUTH.REFRESH_TOKEN_TTL_SECONDS * 1000),
        });

        const refreshToken = generateRefreshToken();
        await insertRefreshToken({ trx, sessionId: session.id, tokenHash: hashToken({ token: refreshToken }) });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.LOGIN_SUCCEEDED,
            actorType: "user",
            actorId: user.id,
            entityType: "auth_session",
            entityId: session.id,
            ipAddress,
            userAgent,
            metadata: { deviceId },
        });

        const accessToken = signAccessToken({
            userId: user.id,
            sessionId: session.id,
        });

        return {
            accessToken,
            accessTokenExpiresAt: new Date(
                now.getTime() + AUTH.ACCESS_TOKEN_TTL_SECONDS * 1000,
            ),
            refreshToken,
            refreshTokenExpiresAt: session.expiresAt,
            user: { id: user.id, phoneNumber: user.phoneNumber },
        };
    });

    return { data };
};

export default createLogin;
