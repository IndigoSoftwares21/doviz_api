import { Socket } from "socket.io";
import USER from "@/constants/user";
import verifyAccessToken from "@/utils/auth/verifyAccessToken";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";

export interface SocketUser {
    userId: string;
    sessionId: string;
    expiresAt: Date | null;
}

/**
 * Same rules as requireAuth, for the socket handshake: a valid access token
 * (sent as `auth.token`) whose session is still live and whose account is
 * active. Anything else is refused without saying why.
 */
const authenticateSocket = async (socket: Socket, next: (error?: Error) => void) => {
    try {
        const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
        if (typeof token !== "string" || !token) return next(new Error("unauthorized"));

        const { userId, sessionId, expiresAt } = verifyAccessToken({ token });
        const session = await selectActiveSession({ sessionId, userId, now: new Date() });
        if (!session || session.accountStatus !== USER.STATUS_ACTIVE) return next(new Error("unauthorized"));

        const user: SocketUser = { userId, sessionId, expiresAt };
        socket.data.user = user;
        return next();
    } catch {
        return next(new Error("unauthorized"));
    }
};

export default authenticateSocket;
