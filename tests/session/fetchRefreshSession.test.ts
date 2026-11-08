import fetchRefreshSession from "@/actions/refreshSession/fetchRefreshSession";
import selectRefreshTokenSession from "@/actions/refreshSession/fetchRefreshSession/queries/selectRefreshTokenSession";
import updateSessionRevoked from "@/actions/refreshSession/fetchRefreshSession/queries/updateSessionRevoked";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import hashToken from "@/utils/auth/hashToken";

jest.mock("@/database", () => ({
    withTransaction: (callback: (trx: unknown) => unknown) => callback({}),
}));
jest.mock("@/actions/refreshSession/fetchRefreshSession/queries/selectRefreshTokenSession");
jest.mock("@/actions/refreshSession/fetchRefreshSession/queries/updateSessionRevoked");
jest.mock("@/actions/auditLog/createAuditLog");

const refreshToken = "rt_abcdefghijklmnopqrstuvwxyz0123456789";
const args = { refreshToken, deviceId: "device-abc-123", ipAddress: "1.2.3.4", userAgent: "jest" };
const row = (overrides = {}) => ({
    refreshTokenId: "rt-1",
    rotatedAt: null,
    sessionId: "session-1",
    userId: "user-1",
    sessionRevokedAt: null,
    expiresAt: new Date(Date.now() + 86_400_000),
    userDeviceId: "ud-1",
    deviceId: "device-abc-123",
    deviceRevokedAt: null,
    accountStatus: "active",
    ...overrides,
});

describe("fetchRefreshSession", () => {
    beforeEach(() => jest.resetAllMocks());

    it("looks tokens up by hash only", async () => {
        jest.mocked(selectRefreshTokenSession).mockResolvedValue(undefined);

        await fetchRefreshSession(args);

        expect(selectRefreshTokenSession).toHaveBeenCalledWith(
            expect.objectContaining({ tokenHash: hashToken({ token: refreshToken }) }),
        );
    });

    it("returns the live session for an unused token on the right device", async () => {
        jest.mocked(selectRefreshTokenSession).mockResolvedValue(row());

        const { data } = await fetchRefreshSession(args);

        expect(data).toEqual(expect.objectContaining({ sessionId: "session-1", userId: "user-1", deviceId: "device-abc-123" }));
    });

    it("revokes the whole session when a used token is presented again", async () => {
        jest.mocked(selectRefreshTokenSession).mockResolvedValue(row({ rotatedAt: new Date() }));
        jest.mocked(updateSessionRevoked).mockResolvedValue({ id: "session-1" });

        const { data } = await fetchRefreshSession(args);

        expect(data).toBeNull();
        expect(updateSessionRevoked).toHaveBeenCalledWith(
            expect.objectContaining({ sessionId: "session-1", revokedReason: "refresh_token_reuse" }),
        );
        expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.refresh_token.reused" }));
    });

    it.each([
        ["a revoked session", { sessionRevokedAt: new Date() }],
        ["an expired session", { expiresAt: new Date(Date.now() - 1000) }],
        ["a removed device", { deviceRevokedAt: new Date() }],
        ["a token from another device", { deviceId: "other-device-999" }],
        ["a suspended account", { accountStatus: "suspended" }],
    ])("rejects %s without revoking", async (_label, overrides) => {
        jest.mocked(selectRefreshTokenSession).mockResolvedValue(row(overrides));

        const { data } = await fetchRefreshSession(args);

        expect(data).toBeNull();
        expect(updateSessionRevoked).not.toHaveBeenCalled();
    });
});
