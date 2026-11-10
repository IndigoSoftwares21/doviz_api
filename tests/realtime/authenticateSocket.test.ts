import { Socket } from "socket.io";
import authenticateSocket from "@/services/realtime/authenticateSocket";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import signAccessToken from "@/utils/auth/signAccessToken";

jest.mock("@/database", () => ({ db: {} }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

const socketWith = (auth: unknown) => ({ handshake: { auth }, data: {} }) as unknown as Socket;
const run = async (socket: Socket) => {
    let result: Error | undefined | "not-called" = "not-called";
    await authenticateSocket(socket, (error) => (result = error));
    return result;
};

describe("authenticateSocket", () => {
    beforeEach(() => jest.resetAllMocks());

    it("accepts a live session and remembers who it is and when the token expires", async () => {
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "d-1", accountStatus: "active" });
        const socket = socketWith({ token: signAccessToken({ userId: "user-1", sessionId: "session-1" }) });

        expect(await run(socket)).toBeUndefined();
        expect(socket.data.user).toMatchObject({ userId: "user-1", sessionId: "session-1" });
        expect(socket.data.user.expiresAt).toBeInstanceOf(Date);
    });

    it.each([
        ["no token", undefined],
        ["a forged token", { token: "not.a.jwt" }],
    ])("refuses %s", async (_, auth) => {
        expect(await run(socketWith(auth))).toEqual(new Error("unauthorized"));
        expect(selectActiveSession).not.toHaveBeenCalled();
    });

    it("refuses a revoked session or an inactive account", async () => {
        const token = signAccessToken({ userId: "user-1", sessionId: "session-1" });
        jest.mocked(selectActiveSession).mockResolvedValue(undefined);
        expect(await run(socketWith({ token }))).toEqual(new Error("unauthorized"));

        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "d-1", accountStatus: "suspended" });
        expect(await run(socketWith({ token }))).toEqual(new Error("unauthorized"));
    });
});
