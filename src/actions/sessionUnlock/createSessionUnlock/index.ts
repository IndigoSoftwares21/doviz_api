import fetchRefreshSession from "@/actions/refreshSession/fetchRefreshSession";
import ACTION_FAILURE from "@/constants/actionFailure";
import UNLOCK_METHOD from "@/constants/unlockMethod";
import verifyUnlockFactor from "./utils/verifyUnlockFactor";
import rotateSessionTokens from "./utils/rotateSessionTokens";

interface ICreateSessionUnlock {
    refreshToken: string;
    deviceId: string;
    pin?: string;
    challengeId?: string;
    signature?: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Unlocks an idle session on a trusted device without SMS: the refresh
// token plus the PIN or a biometric signature (a `login`-purpose challenge).
// On success the refresh token is rotated. Locking the PIN here also ends
// the session, so the next login needs an SMS code.
const createSessionUnlock = async ({
    refreshToken,
    deviceId,
    pin,
    challengeId,
    signature,
    ipAddress,
    userAgent,
}: ICreateSessionUnlock) => {
    const { data: session } = await fetchRefreshSession({ refreshToken, deviceId, ipAddress, userAgent });
    if (!session) return { data: null, failure: ACTION_FAILURE.INVALID_SESSION };

    const rejected = await verifyUnlockFactor({
        userId: session.userId,
        sessionId: session.sessionId,
        deviceId,
        sessionDeviceId: session.deviceId,
        pin,
        challengeId,
        signature,
        ipAddress,
        userAgent,
    });
    if (rejected?.failure === ACTION_FAILURE.PIN) {
        return { data: null, failure: rejected.failure, verification: rejected.verification };
    }
    if (rejected) return { data: null, failure: rejected.failure };

    const data = await rotateSessionTokens({
        session,
        method: pin ? UNLOCK_METHOD.PIN : UNLOCK_METHOD.BIOMETRIC,
        deviceId,
        ipAddress,
        userAgent,
    });
    if (!data) return { data: null, failure: ACTION_FAILURE.INVALID_SESSION };

    return { data, failure: null };
};

export default createSessionUnlock;
