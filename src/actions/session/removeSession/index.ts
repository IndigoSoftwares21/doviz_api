import { withTransaction } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import updateSessionRevoked from "@/actions/refreshSession/fetchRefreshSession/queries/updateSessionRevoked";

interface IRemoveSession {
    userId: string;
    sessionId: string;
    deviceId: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Ends this session. The device stays trusted, so the next login on it
// still needs SMS but its biometrics stay on.
const removeSession = async ({ userId, sessionId, deviceId, ipAddress, userAgent }: IRemoveSession) => {
    const data = await withTransaction(async (trx) => {
        await updateSessionRevoked({ trx, sessionId, revokedAt: new Date(), revokedReason: "logout" });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.LOGOUT,
            actorType: "user",
            actorId: userId,
            entityType: "auth_session",
            entityId: sessionId,
            ipAddress,
            userAgent,
            metadata: { deviceId },
        });

        return { loggedOut: true };
    });

    return { data };
};

export default removeSession;
