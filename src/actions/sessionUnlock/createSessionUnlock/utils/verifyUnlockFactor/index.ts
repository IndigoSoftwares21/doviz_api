import AUTH from "@/constants/auth";
import ACTION_FAILURE from "@/constants/actionFailure";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import createBiometricVerification from "@/actions/biometricVerification/createBiometricVerification";
import revokeLockedSession from "../revokeLockedSession";

interface IVerifyUnlockFactor {
    userId: string;
    sessionId: string;
    deviceId: string;
    sessionDeviceId: string;
    pin?: string;
    challengeId?: string;
    signature?: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Checks the PIN or the biometric signature. Returns null when verified,
// otherwise the failure the controller maps to a response.
const verifyUnlockFactor = async ({
    userId,
    sessionId,
    deviceId,
    sessionDeviceId,
    pin,
    challengeId,
    signature,
    ipAddress,
    userAgent,
}: IVerifyUnlockFactor) => {
    if (pin) {
        const { data: verification } = await createPinVerification({ userId, pin, ipAddress, userAgent });
        if (verification.status === PIN_VERIFICATION_STATUS.VERIFIED) return null;

        if (verification.status === PIN_VERIFICATION_STATUS.LOCKED) {
            await revokeLockedSession({ userId, sessionId, deviceId, ipAddress, userAgent });
        }

        return { failure: ACTION_FAILURE.PIN, verification } as const;
    }

    // The schema guarantees challengeId and signature when no PIN is sent.
    const { data: biometric } = await createBiometricVerification({
        userId,
        challengeId: challengeId!,
        signature: signature!,
        purpose: AUTH.BIOMETRIC_PURPOSE_LOGIN,
        deviceId: sessionDeviceId,
        ipAddress,
        userAgent,
    });

    return biometric ? null : ({ failure: ACTION_FAILURE.BIOMETRIC, verification: null } as const);
};

export default verifyUnlockFactor;
