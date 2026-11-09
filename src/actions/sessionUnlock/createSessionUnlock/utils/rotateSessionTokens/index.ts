import { withTransaction } from "@/database";
import AUTH from "@/constants/auth";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { UnlockMethod } from "@/constants/unlockMethod";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import insertRefreshToken from "@/actions/login/createLogin/queries/insertRefreshToken";
import generateRefreshToken from "@/utils/auth/generateRefreshToken";
import hashToken from "@/utils/auth/hashToken";
import signAccessToken from "@/utils/auth/signAccessToken";
import updateRefreshTokenRotated from "../../queries/updateRefreshTokenRotated";
import updateSessionLastUsed from "../../queries/updateSessionLastUsed";
import updateUserDeviceSeen from "../../queries/updateUserDeviceSeen";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

interface IRotateSessionTokens {
    session: {
        userId: string;
        sessionId: string;
        refreshTokenId: string;
        userDeviceId: string;
        expiresAt: Date;
    };
    method: UnlockMethod;
    deviceId: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Rotates the refresh token and issues a new access token. Returns null if
// the token was rotated concurrently (a racing unlock or refresh won).
const rotateSessionTokens = ({ session, method, deviceId, ipAddress, userAgent }: IRotateSessionTokens) => {
    const { userId, sessionId, refreshTokenId, userDeviceId, expiresAt } = session;

    return withTransaction(async (trx) => {
        const now = new Date();

        const rotated = await updateRefreshTokenRotated({ trx, id: refreshTokenId, rotatedAt: now });
        if (!rotated) return null;

        const refreshToken = generateRefreshToken();
        await insertRefreshToken({ trx, sessionId, tokenHash: hashToken({ token: refreshToken }) });
        await updateSessionLastUsed({ trx, sessionId, lastUsedAt: now });
        await updateUserDeviceSeen({ trx, userDeviceId, lastSeenAt: now, lastIp: ipAddress });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.SESSION_UNLOCKED,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.AUTH_SESSION,
            entityId: sessionId,
            ipAddress,
            userAgent,
            metadata: { method, deviceId },
        });

        return {
            accessToken: signAccessToken({ userId, sessionId }),
            accessTokenExpiresAt: new Date(now.getTime() + AUTH.ACCESS_TOKEN_TTL_SECONDS * 1000),
            refreshToken,
            refreshTokenExpiresAt: expiresAt,
        };
    });
};

export default rotateSessionTokens;
