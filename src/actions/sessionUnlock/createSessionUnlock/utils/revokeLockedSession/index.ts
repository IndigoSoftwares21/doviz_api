import { withTransaction } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import SESSION_REVOKE_REASON from "@/constants/sessionRevokeReason";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import updateSessionRevoked from "@/actions/refreshSession/fetchRefreshSession/queries/updateSessionRevoked";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

interface IRevokeLockedSession {
    userId: string;
    sessionId: string;
    deviceId: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// A PIN lock during unlock ends the session, so the next login needs SMS.
const revokeLockedSession = async ({ userId, sessionId, deviceId, ipAddress, userAgent }: IRevokeLockedSession) => {
    await withTransaction(async (trx) => {
        const revoked = await updateSessionRevoked({
            trx,
            sessionId,
            revokedAt: new Date(),
            revokedReason: SESSION_REVOKE_REASON.PIN_LOCKED,
        });

        if (!revoked) return;

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.SESSION_REVOKED,
            actorType: AUDIT_ACTOR_TYPE.SYSTEM,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.AUTH_SESSION,
            entityId: sessionId,
            ipAddress,
            userAgent,
            metadata: { reason: SESSION_REVOKE_REASON.PIN_LOCKED, deviceId },
        });
    });
};

export default revokeLockedSession;
