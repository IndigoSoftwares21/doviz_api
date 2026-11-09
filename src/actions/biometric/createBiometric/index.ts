import { withTransaction } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import updateDeviceBiometricKeysRevoked from "./queries/updateDeviceBiometricKeysRevoked";
import insertBiometricKey from "./queries/insertBiometricKey";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

interface ICreateBiometric {
    userId: string;
    deviceId: string;
    deviceName: string | null;
    publicKey: string;
    pin: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Turning biometrics on requires the PIN. Re-enrolling the same device
// replaces its previous key. data is null when the PIN didn't verify.
const createBiometric = async ({
    userId,
    deviceId,
    deviceName,
    publicKey,
    pin,
    ipAddress,
    userAgent,
}: ICreateBiometric) => {
    const { data: verification } = await createPinVerification({ userId, pin, ipAddress, userAgent });

    if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) {
        return { data: null, verification };
    }

    const data = await withTransaction(async (trx) => {
        const now = new Date();

        await updateDeviceBiometricKeysRevoked({ trx, userId, deviceId, revokedAt: now });

        const biometricKey = await insertBiometricKey({ trx, userId, deviceId, deviceName, publicKey });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.BIOMETRIC_ENABLED,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.BIOMETRIC_KEY,
            entityId: biometricKey.id,
            ipAddress,
            userAgent,
            metadata: { deviceId, deviceName },
        });

        return biometricKey;
    });

    return { data, verification };
};

export default createBiometric;
