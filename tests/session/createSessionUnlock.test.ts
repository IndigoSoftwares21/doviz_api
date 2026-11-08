import jwt from "jsonwebtoken";
import createSessionUnlock from "@/actions/sessionUnlock/createSessionUnlock";
import fetchRefreshSession from "@/actions/refreshSession/fetchRefreshSession";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import createBiometricVerification from "@/actions/biometricVerification/createBiometricVerification";
import updateSessionRevoked from "@/actions/refreshSession/fetchRefreshSession/queries/updateSessionRevoked";
import insertRefreshToken from "@/actions/login/createLogin/queries/insertRefreshToken";
import updateRefreshTokenRotated from "@/actions/sessionUnlock/createSessionUnlock/queries/updateRefreshTokenRotated";
import updateSessionLastUsed from "@/actions/sessionUnlock/createSessionUnlock/queries/updateSessionLastUsed";
import updateUserDeviceSeen from "@/actions/sessionUnlock/createSessionUnlock/queries/updateUserDeviceSeen";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import hashToken from "@/utils/auth/hashToken";

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

jest.mock("@/database", () => ({
    withTransaction: (callback: (trx: unknown) => unknown) => callback({}),
}));
jest.mock("@/actions/refreshSession/fetchRefreshSession");
jest.mock("@/actions/pinVerification/createPinVerification");
jest.mock("@/actions/biometricVerification/createBiometricVerification");
jest.mock("@/actions/refreshSession/fetchRefreshSession/queries/updateSessionRevoked");
jest.mock("@/actions/login/createLogin/queries/insertRefreshToken");
jest.mock("@/actions/sessionUnlock/createSessionUnlock/queries/updateRefreshTokenRotated");
jest.mock("@/actions/sessionUnlock/createSessionUnlock/queries/updateSessionLastUsed");
jest.mock("@/actions/sessionUnlock/createSessionUnlock/queries/updateUserDeviceSeen");
jest.mock("@/actions/auditLog/createAuditLog");

const session = {
    refreshTokenId: "rt-1",
    sessionId: "session-1",
    userId: "user-1",
    userDeviceId: "ud-1",
    deviceId: "device-abc-123",
    expiresAt: new Date(Date.now() + 86_400_000),
};
const base = { refreshToken: "rt_abcdefghijklmnopqrstuvwxyz0123456789", deviceId: "device-abc-123", ipAddress: "1.2.3.4", userAgent: "jest" };

describe("createSessionUnlock", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(fetchRefreshSession).mockResolvedValue({ data: session });
        jest.mocked(updateRefreshTokenRotated).mockResolvedValue({ id: "rt-1" });
    });

    it("sends the user to SMS login when the refresh session isn't valid", async () => {
        jest.mocked(fetchRefreshSession).mockResolvedValue({ data: null });

        const result = await createSessionUnlock({ ...base, pin: "4827" });

        expect(result.failure).toBe("invalid_session");
        expect(createPinVerification).not.toHaveBeenCalled();
    });

    it("unlocks with the right PIN, rotating the refresh token", async () => {
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } });

        const result = await createSessionUnlock({ ...base, pin: "4827" });

        expect(result.failure).toBeNull();
        expect(updateRefreshTokenRotated).toHaveBeenCalledWith(expect.objectContaining({ id: "rt-1" }));
        const { tokenHash } = jest.mocked(insertRefreshToken).mock.calls[0][0];
        expect(tokenHash).toBe(hashToken({ token: result.data!.refreshToken }));
        expect(result.data!.refreshToken).not.toBe(base.refreshToken);
        expect(updateSessionLastUsed).toHaveBeenCalled();
        expect(updateUserDeviceSeen).toHaveBeenCalledWith(expect.objectContaining({ userDeviceId: "ud-1", lastIp: "1.2.3.4" }));

        const claims = jwt.verify(result.data!.accessToken, process.env.JWT_ACCESS_SECRET!) as jwt.JwtPayload;
        expect(claims.sid).toBe("session-1");
        expect(claims.exp! - claims.iat!).toBe(5 * 60);
        expect(createAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: "auth.session.unlocked", metadata: { method: "pin", deviceId: "device-abc-123" } }),
        );
    });

    it("keeps the session on a wrong PIN", async () => {
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "invalid", remainingAttempts: 3 } });

        const result = await createSessionUnlock({ ...base, pin: "9999" });

        expect(result).toEqual({ data: null, failure: "pin", verification: { status: "invalid", remainingAttempts: 3 } });
        expect(updateSessionRevoked).not.toHaveBeenCalled();
        expect(updateRefreshTokenRotated).not.toHaveBeenCalled();
    });

    it("ends the session when the PIN locks", async () => {
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "locked", lockedUntil: new Date() } });
        jest.mocked(updateSessionRevoked).mockResolvedValue({ id: "session-1" });

        const result = await createSessionUnlock({ ...base, pin: "9999" });

        expect(result.failure).toBe("pin");
        expect(updateSessionRevoked).toHaveBeenCalledWith(
            expect.objectContaining({ sessionId: "session-1", revokedReason: "pin_locked" }),
        );
    });

    it("unlocks with biometrics using a login-purpose challenge on this device", async () => {
        jest.mocked(createBiometricVerification).mockResolvedValue({ data: { verified: true, deviceId: "device-abc-123" } });

        const result = await createSessionUnlock({ ...base, challengeId: "c-1", signature: "sig" });

        expect(result.failure).toBeNull();
        expect(createBiometricVerification).toHaveBeenCalledWith(
            expect.objectContaining({ purpose: "login", deviceId: "device-abc-123", userId: "user-1" }),
        );
        expect(createPinVerification).not.toHaveBeenCalled();
    });

    it("fails a bad biometric signature without touching tokens", async () => {
        jest.mocked(createBiometricVerification).mockResolvedValue({ data: null });

        const result = await createSessionUnlock({ ...base, challengeId: "c-1", signature: "bad" });

        expect(result.failure).toBe("biometric");
        expect(updateRefreshTokenRotated).not.toHaveBeenCalled();
    });

    it("loses a race cleanly when another unlock already used the token", async () => {
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } });
        jest.mocked(updateRefreshTokenRotated).mockResolvedValue(undefined);

        const result = await createSessionUnlock({ ...base, pin: "4827" });

        expect(result.failure).toBe("invalid_session");
        expect(insertRefreshToken).not.toHaveBeenCalled();
    });
});
