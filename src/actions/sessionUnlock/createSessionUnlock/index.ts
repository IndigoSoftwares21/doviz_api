import { withTransaction } from "@/database";
import AUTH from "@/constants/auth";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import fetchRefreshSession from "@/actions/refreshSession/fetchRefreshSession";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import createBiometricVerification from "@/actions/biometricVerification/createBiometricVerification";
import updateSessionRevoked from "@/actions/refreshSession/fetchRefreshSession/queries/updateSessionRevoked";
import insertRefreshToken from "@/actions/login/createLogin/queries/insertRefreshToken";
import generateRefreshToken from "@/utils/auth/generateRefreshToken";
import hashToken from "@/utils/auth/hashToken";
import signAccessToken from "@/utils/auth/signAccessToken";
import updateRefreshTokenRotated from "./queries/updateRefreshTokenRotated";
import updateSessionLastUsed from "./queries/updateSessionLastUsed";
import updateUserDeviceSeen from "./queries/updateUserDeviceSeen";

interface ICreateSessionUnlock {
    refreshToken: string;
    deviceId: string;
    pin?: string;
    challengeId?: string;
    signature?: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Unlocks an idle session on a trusted device without SMS: the refresh
// token plus the PIN or a biometric signature (a `login`-purpose challenge).
// On success the refresh token is rotated. Locking the PIN here also ends
// the session, so the next login needs an SMS code.
const createSessionUnlock = async ({
    refreshToken,
    deviceId,
    pin,
    challengeId,
    signature,
    ipAddress,
    userAgent,
}: ICreateSessionUnlock) => {
    const { data: session } = await fetchRefreshSession({ refreshToken, deviceId, ipAddress, userAgent });

    if (!session) {
        return { data: null, failure: "invalid_session" as const };
    }

    const method = pin ? "pin" : "biometric";

    if (pin) {
        const { data: verification } = await createPinVerification({
            userId: session.userId,
            pin,
            ipAddress,
            userAgent,
        });

        if (verification.status !== "verified") {
            if (verification.status === "locked") {
                await withTransaction(async (trx) => {
                    const revoked = await updateSessionRevoked({
                        trx,
                        sessionId: session.sessionId,
                        revokedAt: new Date(),
                        revokedReason: "pin_locked",
                    });

                    if (revoked) {
                        await createAuditLog({
                            trx,
                            action: AUDIT_ACTIONS.SESSION_REVOKED,
                            actorType: "system",
                            actorId: session.userId,
                            entityType: "auth_session",
                            entityId: session.sessionId,
                            ipAddress,
                            userAgent,
                            metadata: { reason: "pin_locked", deviceId },
                        });
                    }
                });
            }

            return { data: null, failure: "pin" as const, verification };
        }
    } else {
        const { data: biometric } = await createBiometricVerification({
            userId: session.userId,
            challengeId: challengeId!,
            signature: signature!,
            purpose: AUTH.BIOMETRIC_PURPOSE_LOGIN,
            deviceId: session.deviceId,
            ipAddress,
            userAgent,
        });

        if (!biometric) {
            return { data: null, failure: "biometric" as const };
        }
    }

    const data = await withTransaction(async (trx) => {
        const now = new Date();

        const rotated = await updateRefreshTokenRotated({ trx, id: session.refreshTokenId, rotatedAt: now });

        if (!rotated) {
            return null;
        }

        const newRefreshToken = generateRefreshToken();
        await insertRefreshToken({ trx, sessionId: session.sessionId, tokenHash: hashToken({ token: newRefreshToken }) });
        await updateSessionLastUsed({ trx, sessionId: session.sessionId, lastUsedAt: now });
        await updateUserDeviceSeen({ trx, userDeviceId: session.userDeviceId, lastSeenAt: now, lastIp: ipAddress });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.SESSION_UNLOCKED,
            actorType: "user",
            actorId: session.userId,
            entityType: "auth_session",
            entityId: session.sessionId,
            ipAddress,
            userAgent,
            metadata: { method, deviceId },
        });

        return {
            accessToken: signAccessToken({ userId: session.userId, sessionId: session.sessionId }),
            accessTokenExpiresAt: new Date(now.getTime() + AUTH.ACCESS_TOKEN_TTL_SECONDS * 1000),
            refreshToken: newRefreshToken,
            refreshTokenExpiresAt: session.expiresAt,
        };
    });

    if (!data) {
        return { data: null, failure: "invalid_session" as const };
    }

    return { data, failure: null };
};

export default createSessionUnlock;
