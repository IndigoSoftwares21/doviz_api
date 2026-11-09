import { withTransaction } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import updateDeviceSessionsRevoked from "@/actions/login/createLogin/queries/updateDeviceSessionsRevoked";
import updateDeviceBiometricKeysRevoked from "@/actions/biometric/removeBiometric/queries/updateDeviceBiometricKeysRevoked";
import updateUserDeviceRevoked from "./queries/updateUserDeviceRevoked";
import SESSION_REVOKE_REASON from "@/constants/sessionRevokeReason";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

interface IRemoveDevice {
    userId: string;
    deviceId: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Signs a device out and untrusts it: ends its session and turns its
// biometrics off. It needs an SMS login to be used again. Idempotent.
const removeDevice = async ({ userId, deviceId, ipAddress, userAgent }: IRemoveDevice) => {
    const data = await withTransaction(async (trx) => {
        const now = new Date();

        const device = await updateUserDeviceRevoked({ trx, userId, deviceId, revokedAt: now });

        if (!device) {
            return { deviceId, removed: false };
        }

        const revokedSessions = await updateDeviceSessionsRevoked({
            trx,
            userDeviceId: device.id,
            revokedAt: now,
            revokedReason: SESSION_REVOKE_REASON.DEVICE_REMOVED,
        });

        const revokedKeys = await updateDeviceBiometricKeysRevoked({ trx, userId, deviceId, revokedAt: now });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.DEVICE_REVOKED,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.USER_DEVICE,
            entityId: device.id,
            ipAddress,
            userAgent,
            metadata: { deviceId, sessionsRevoked: revokedSessions.length, biometricKeysRevoked: revokedKeys.length },
        });

        return { deviceId, removed: true };
    });

    return { data };
};

export default removeDevice;
