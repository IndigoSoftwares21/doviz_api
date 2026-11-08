import { withTransaction } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import USER from "@/constants/user";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import hashToken from "@/utils/auth/hashToken";
import selectRefreshTokenSession from "./queries/selectRefreshTokenSession";
import updateSessionRevoked from "./queries/updateSessionRevoked";

interface IFetchRefreshSession {
    refreshToken: string;
    deviceId: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Resolves a refresh token to its live session. Refresh tokens are
// single-use: presenting one that was already rotated means it was copied,
// so the whole session is revoked (that write is committed even though the
// caller gets null). Also null for an expired/revoked session, a removed
// device, a token presented from a different device, or an inactive account.
const fetchRefreshSession = async ({ refreshToken, deviceId, ipAddress, userAgent }: IFetchRefreshSession) => {
    const data = await withTransaction(async (trx) => {
        const now = new Date();

        const row = await selectRefreshTokenSession({ trx, tokenHash: hashToken({ token: refreshToken }) });

        if (!row) {
            return null;
        }

        if (row.rotatedAt) {
            const revoked = await updateSessionRevoked({
                trx,
                sessionId: row.sessionId,
                revokedAt: now,
                revokedReason: "refresh_token_reuse",
            });

            if (revoked) {
                await createAuditLog({
                    trx,
                    action: AUDIT_ACTIONS.REFRESH_TOKEN_REUSED,
                    actorType: "user",
                    actorId: row.userId,
                    entityType: "auth_session",
                    entityId: row.sessionId,
                    ipAddress,
                    userAgent,
                    metadata: { deviceId: row.deviceId, presentedDeviceId: deviceId },
                });
            }

            return null;
        }

        if (
            row.sessionRevokedAt ||
            row.expiresAt <= now ||
            row.deviceRevokedAt ||
            row.deviceId !== deviceId ||
            row.accountStatus !== USER.STATUS_ACTIVE
        ) {
            return null;
        }

        return {
            refreshTokenId: row.refreshTokenId,
            sessionId: row.sessionId,
            userId: row.userId,
            userDeviceId: row.userDeviceId,
            deviceId: row.deviceId,
            expiresAt: row.expiresAt,
        };
    });

    return { data };
};

export default fetchRefreshSession;
