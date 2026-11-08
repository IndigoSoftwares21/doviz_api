import { withTransaction } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import updateDeviceBiometricKeysRevoked from "./queries/updateDeviceBiometricKeysRevoked";

interface IRemoveBiometric {
    userId: string;
    deviceId: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Turning biometrics off only lowers privilege, so no PIN is required.
// Idempotent: turning off an already-off device succeeds.
const removeBiometric = async ({ userId, deviceId, ipAddress, userAgent }: IRemoveBiometric) => {
    const data = await withTransaction(async (trx) => {
        const revokedKeys = await updateDeviceBiometricKeysRevoked({
            trx,
            userId,
            deviceId,
            revokedAt: new Date(),
        });

        if (revokedKeys.length > 0) {
            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.BIOMETRIC_DISABLED,
                actorType: "user",
                actorId: userId,
                entityType: "biometric_key",
                entityId: revokedKeys[0].id,
                ipAddress,
                userAgent,
                metadata: { deviceId },
            });
        }

        return { deviceId, enabled: false };
    });

    return { data };
};

export default removeBiometric;
