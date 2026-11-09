import AUTH from "@/constants/auth";
import fetchRefreshSession from "@/actions/refreshSession/fetchRefreshSession";
import createBiometricChallenge from "@/actions/biometricChallenge/createBiometricChallenge";
import ACTION_FAILURE from "@/constants/actionFailure";

interface ICreateSessionChallenge {
    refreshToken: string;
    deviceId: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// A `login`-purpose biometric challenge for unlocking an idle session.
// Doesn't rotate the refresh token — that happens on unlock.
const createSessionChallenge = async ({ refreshToken, deviceId, ipAddress, userAgent }: ICreateSessionChallenge) => {
    const { data: session } = await fetchRefreshSession({ refreshToken, deviceId, ipAddress, userAgent });

    if (!session) {
        return { data: null, failure: ACTION_FAILURE.INVALID_SESSION };
    }

    const { data } = await createBiometricChallenge({
        userId: session.userId,
        deviceId: session.deviceId,
        purpose: AUTH.BIOMETRIC_PURPOSE_LOGIN,
    });

    if (!data) {
        return { data: null, failure: ACTION_FAILURE.BIOMETRICS_OFF };
    }

    return { data, failure: null };
};

export default createSessionChallenge;
