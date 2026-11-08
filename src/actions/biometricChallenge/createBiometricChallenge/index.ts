import AUTH from "@/constants/auth";
import generateBiometricChallenge from "@/utils/auth/generateBiometricChallenge";
import selectBiometricKeyForDevice from "./queries/selectBiometricKeyForDevice";
import insertBiometricChallenge from "./queries/insertBiometricChallenge";

interface ICreateBiometricChallenge {
    userId: string;
    deviceId: string;
    purpose: typeof AUTH.BIOMETRIC_PURPOSE_VERIFICATION | typeof AUTH.BIOMETRIC_PURPOSE_LOGIN;
}

// data is null when biometrics aren't on for this device.
const createBiometricChallenge = async ({ userId, deviceId, purpose }: ICreateBiometricChallenge) => {
    const biometricKey = await selectBiometricKeyForDevice({ userId, deviceId });

    if (!biometricKey) {
        return { data: null };
    }

    const challengeRow = await insertBiometricChallenge({
        userId,
        biometricKeyId: biometricKey.id,
        purpose,
        challenge: generateBiometricChallenge(),
        expiresAt: new Date(Date.now() + AUTH.BIOMETRIC_CHALLENGE_TTL_SECONDS * 1000),
    });

    const data = {
        challengeId: challengeRow.id,
        challenge: challengeRow.challenge,
        expiresAt: challengeRow.expiresAt,
    };

    return { data };
};

export default createBiometricChallenge;
