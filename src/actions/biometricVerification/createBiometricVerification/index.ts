import { withTransaction } from "@/database";
import AUTH from "@/constants/auth";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import verifyBiometricSignature from "@/utils/auth/verifyBiometricSignature";
import selectLiveBiometricChallenge from "./queries/selectLiveBiometricChallenge";
import updateBiometricChallengeConsumed from "./queries/updateBiometricChallengeConsumed";
import selectActiveBiometricKeyById from "./queries/selectActiveBiometricKeyById";
import updateBiometricKeyLastUsed from "./queries/updateBiometricKeyLastUsed";

interface ICreateBiometricVerification {
    userId: string;
    challengeId: string;
    signature: string;
    purpose: typeof AUTH.BIOMETRIC_PURPOSE_VERIFICATION | typeof AUTH.BIOMETRIC_PURPOSE_LOGIN;
    deviceId: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Reusable biometric check. The challenge must have been issued for this
// purpose, and signed by the key of the device making the request. The challenge is burned on the first attempt —
// right or wrong — so a signature can't be replayed or a challenge retried.
// Returns { data: null } for any failure; the reason goes to the audit log.
const createBiometricVerification = async ({
    userId,
    challengeId,
    signature,
    purpose,
    deviceId,
    ipAddress,
    userAgent,
}: ICreateBiometricVerification) => {
    const data = await withTransaction(async (trx) => {
        const now = new Date();

        const fail = async (reason: string, deviceId?: string) => {
            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.BIOMETRIC_VERIFICATION_FAILED,
                actorType: "user",
                actorId: userId,
                entityType: "biometric_challenge",
                entityId: challengeId,
                ipAddress,
                userAgent,
                metadata: deviceId ? { reason, deviceId } : { reason },
            });

            return null;
        };

        const challengeRow = await selectLiveBiometricChallenge({ trx, challengeId, userId, purpose, now });

        if (!challengeRow) {
            return fail("no_live_challenge");
        }

        await updateBiometricChallengeConsumed({ trx, id: challengeRow.id, consumedAt: now });

        const biometricKey = await selectActiveBiometricKeyById({ trx, id: challengeRow.biometricKeyId });

        if (!biometricKey) {
            return fail("key_revoked");
        }

        if (biometricKey.deviceId !== deviceId) {
            return fail("device_mismatch", biometricKey.deviceId);
        }

        const isValid = verifyBiometricSignature({
            publicKey: biometricKey.publicKey,
            message: challengeRow.challenge,
            signature,
        });

        if (!isValid) {
            return fail("invalid_signature", biometricKey.deviceId);
        }

        await updateBiometricKeyLastUsed({ trx, id: biometricKey.id, lastUsedAt: now });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.BIOMETRIC_VERIFIED,
            actorType: "user",
            actorId: userId,
            entityType: "biometric_key",
            entityId: biometricKey.id,
            ipAddress,
            userAgent,
            metadata: { deviceId: biometricKey.deviceId },
        });

        return { verified: true, deviceId: biometricKey.deviceId };
    });

    return { data };
};

export default createBiometricVerification;
