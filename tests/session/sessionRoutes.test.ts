import request from "supertest";
import app from "../../src/app";
import signAccessToken from "@/utils/auth/signAccessToken";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import createSessionUnlock from "@/actions/sessionUnlock/createSessionUnlock";
import createSessionChallenge from "@/actions/sessionChallenge/createSessionChallenge";
import removeSession from "@/actions/session/removeSession";
import fetchDevices from "@/actions/devices/fetchDevices";
import removeDevice from "@/actions/device/removeDevice";

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/actions/sessionUnlock/createSessionUnlock");
jest.mock("@/actions/sessionChallenge/createSessionChallenge");
jest.mock("@/actions/session/removeSession");
jest.mock("@/actions/devices/fetchDevices");
jest.mock("@/actions/device/removeDevice");

const url = (path: string) => `/api/v1/app/auth${path}`;
const auth = () => `Bearer ${signAccessToken({ userId: "user-1", sessionId: "session-1" })}`;
const unlockBody = { refreshToken: "rt_abcdefghijklmnopqrstuvwxyz0123456789", deviceId: "device-abc-123" };
const tokens = {
    accessToken: "access",
    accessTokenExpiresAt: new Date(),
    refreshToken: "new-refresh",
    refreshTokenExpiresAt: new Date(),
};

describe("POST /auth/session/unlock", () => {
    beforeEach(() => jest.resetAllMocks());

    it("unlocks with a PIN — no access token needed", async () => {
        jest.mocked(createSessionUnlock).mockResolvedValue({ data: tokens, failure: null });

        const response = await request(app.express).post(url("/session/unlock")).send({ ...unlockBody, pin: "4827" });

        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(response.body.data.refreshToken).toBe("new-refresh");
    });

    it.each([
        ["neither method", {}],
        ["both methods", { pin: "4827", challengeId: "11111111-1111-4111-8111-111111111111", signature: "abc" }],
        ["half a biometric", { challengeId: "11111111-1111-4111-8111-111111111111" }],
    ])("rejects %s", async (_label, extra) => {
        const response = await request(app.express).post(url("/session/unlock")).send({ ...unlockBody, ...extra });

        expect(response.status).toBe(400);
        expect(createSessionUnlock).not.toHaveBeenCalled();
    });

    it("returns 401 (go to SMS login) for a dead session", async () => {
        jest.mocked(createSessionUnlock).mockResolvedValue({ data: null, failure: "invalid_session" });

        const response = await request(app.express).post(url("/session/unlock")).send({ ...unlockBody, pin: "4827" });

        expect(response.status).toBe(401);
        expect(response.body.message).toMatch(/SMS/);
    });

    it("returns 400 with attempts left for a wrong PIN", async () => {
        jest.mocked(createSessionUnlock).mockResolvedValue({
            data: null,
            failure: "pin",
            verification: { status: "invalid", remainingAttempts: 2 },
        });

        const response = await request(app.express).post(url("/session/unlock")).send({ ...unlockBody, pin: "9999" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Incorrect PIN. 2 attempts remaining.");
    });

    it("returns 423 telling the user to log in by SMS when the PIN locks", async () => {
        jest.mocked(createSessionUnlock).mockResolvedValue({
            data: null,
            failure: "pin",
            verification: { status: "locked", lockedUntil: new Date() },
        });

        const response = await request(app.express).post(url("/session/unlock")).send({ ...unlockBody, pin: "9999" });

        expect(response.status).toBe(423);
        expect(response.body.message).toMatch(/SMS/);
    });
});

describe("POST /auth/session/challenge", () => {
    beforeEach(() => jest.resetAllMocks());

    it("returns 400 when biometrics are off for the device", async () => {
        jest.mocked(createSessionChallenge).mockResolvedValue({ data: null, failure: "biometrics_off" });

        const response = await request(app.express).post(url("/session/challenge")).send(unlockBody);

        expect(response.status).toBe(400);
    });
});

describe("devices and logout", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "device-abc-123", accountStatus: "active" });
    });

    it("logs out the current session", async () => {
        jest.mocked(removeSession).mockResolvedValue({ data: { loggedOut: true } });

        const response = await request(app.express).post(url("/logout")).set("Authorization", auth());

        expect(response.status).toBe(200);
        expect(removeSession).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1", sessionId: "session-1", deviceId: "device-abc-123" }),
        );
    });

    it("lists devices, marking the current one", async () => {
        jest.mocked(fetchDevices).mockResolvedValue({ data: [] });

        const response = await request(app.express).get(url("/devices")).set("Authorization", auth());

        expect(response.status).toBe(200);
        expect(fetchDevices).toHaveBeenCalledWith({ userId: "user-1", currentDeviceId: "device-abc-123" });
    });

    it("signs out another device", async () => {
        jest.mocked(removeDevice).mockResolvedValue({ data: { deviceId: "device-old-999", removed: true } });

        const response = await request(app.express).delete(url("/devices/device-old-999")).set("Authorization", auth());

        expect(response.status).toBe(200);
        expect(removeDevice).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", deviceId: "device-old-999" }));
    });
});
