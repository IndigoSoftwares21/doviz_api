import { withTransaction } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import updateSessionRevoked from "@/actions/refreshSession/fetchRefreshSession/queries/updateSessionRevoked";
import SESSION_REVOKE_REASON from "@/constants/sessionRevokeReason";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

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
        await updateSessionRevoked({ trx, sessionId, revokedAt: new Date(), revokedReason: SESSION_REVOKE_REASON.LOGOUT });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.LOGOUT,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.AUTH_SESSION,
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
