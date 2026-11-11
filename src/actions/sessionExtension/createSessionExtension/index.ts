import signAccessToken from "@/utils/auth/signAccessToken";
import AUTH from "@/constants/auth";

/**
 * A fresh access token for a session that is still live (requireAuth has
 * already checked the current token, the session, the device and the
 * account). Lets an app the user is actively using stay signed in past one
 * token's lifetime without asking for the PIN. Needs a VALID access token —
 * once it has expired (the user was idle), only unlock (PIN / biometrics)
 * gets a new one, so the refresh token alone never skips the PIN.
 */
const createSessionExtension = ({ userId, sessionId }: { userId: string; sessionId: string }) => {
    const now = Date.now();
    const data = {
        accessToken: signAccessToken({ userId, sessionId }),
        accessTokenExpiresAt: new Date(now + AUTH.ACCESS_TOKEN_TTL_SECONDS * 1000),
    };

    return { data };
};

export default createSessionExtension;
