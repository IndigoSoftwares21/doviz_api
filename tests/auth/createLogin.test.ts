import jwt from "jsonwebtoken";
import createLogin from "@/actions/login/createLogin";
import hashOtp from "@/utils/auth/hashOtp";
import hashToken from "@/utils/auth/hashToken";
import selectLiveOtp from "@/actions/login/createLogin/queries/selectLiveOtp";
import updateOtpAttempts from "@/actions/login/createLogin/queries/updateOtpAttempts";
import updateOtpConsumed from "@/actions/login/createLogin/queries/updateOtpConsumed";
import insertUser from "@/actions/login/createLogin/queries/insertUser";
import insertSession from "@/actions/login/createLogin/queries/insertSession";
import insertUserDevice from "@/actions/login/createLogin/queries/insertUserDevice";
import updateDeviceSessionsRevoked from "@/actions/login/createLogin/queries/updateDeviceSessionsRevoked";
import insertRefreshToken from "@/actions/login/createLogin/queries/insertRefreshToken";
import createAuditLog from "@/actions/auditLog/createAuditLog";

process.env.OTP_PEPPER = "test-pepper-test-pepper-test-pepper-0001";
process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

jest.mock("@/database", () => ({
    withTransaction: (callback: (trx: unknown) => unknown) => callback({}),
}));
jest.mock("@/actions/login/createLogin/queries/selectLiveOtp");
jest.mock("@/actions/login/createLogin/queries/updateOtpAttempts");
jest.mock("@/actions/login/createLogin/queries/updateOtpConsumed");
jest.mock("@/actions/login/createLogin/queries/insertUser");
jest.mock("@/actions/login/createLogin/queries/insertSession");
jest.mock("@/actions/login/createLogin/queries/insertUserDevice");
jest.mock("@/actions/login/createLogin/queries/updateDeviceSessionsRevoked");
jest.mock("@/actions/login/createLogin/queries/insertRefreshToken");
jest.mock("@/actions/auditLog/createAuditLog");

const phoneNumber = "+2348012345678";
const otpRow = (overrides = {}) => ({
    id: "otp-1",
    codeHash: hashOtp({ subject: phoneNumber, otp: "987650" }),
    attempts: 0,
    maxAttempts: 5,
    ...overrides,
});
const baseArgs = {
    phoneNumber,
    deviceId: "device-abc-123",
    deviceName: "Ada's iPhone",
    platform: "ios",
    ipAddress: "1.2.3.4",
    userAgent: "jest",
};

const auditActions = () =>
    jest.mocked(createAuditLog).mock.calls.map(([args]) => args.action);

describe("createLogin", () => {
    beforeEach(() => jest.resetAllMocks());

    it("returns null when there is no live OTP", async () => {
        jest.mocked(selectLiveOtp).mockResolvedValue(undefined);

        const { data } = await createLogin({ ...baseArgs, otp: "987650" });

        expect(data).toBeNull();
        expect(updateOtpAttempts).not.toHaveBeenCalled();
        expect(insertSession).not.toHaveBeenCalled();
        expect(createAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "auth.login.failed",
                metadata: { phoneNumber, reason: "no_live_otp" },
            }),
        );
    });

    it("counts a wrong guess without revoking before the limit", async () => {
        jest.mocked(selectLiveOtp).mockResolvedValue(otpRow({ attempts: 2 }));

        const { data } = await createLogin({ ...baseArgs, otp: "000000" });

        expect(data).toBeNull();
        expect(updateOtpAttempts).toHaveBeenCalledWith(
            expect.objectContaining({ id: "otp-1", attempts: 3, revokedAt: null }),
        );
        expect(updateOtpConsumed).not.toHaveBeenCalled();
        expect(auditActions()).toEqual(["auth.login.failed"]);
    });

    it("revokes the OTP on the final allowed wrong guess", async () => {
        jest.mocked(selectLiveOtp).mockResolvedValue(otpRow({ attempts: 4 }));

        await createLogin({ ...baseArgs, otp: "000000" });

        expect(updateOtpAttempts).toHaveBeenCalledWith(
            expect.objectContaining({ attempts: 5, revokedAt: expect.any(Date) }),
        );
        expect(auditActions()).toEqual(["auth.login.failed", "auth.otp.locked"]);
    });

    it("consumes the OTP and issues tokens on the right code", async () => {
        jest.mocked(selectLiveOtp).mockResolvedValue(otpRow());
        jest.mocked(insertUser).mockResolvedValue({ id: "user-1", phoneNumber, isNewUser: true });
        jest.mocked(insertUserDevice).mockResolvedValue({ id: "ud-1", deviceId: "device-abc-123", isNewDevice: true });
        jest.mocked(insertSession).mockResolvedValue({
            id: "session-1",
            expiresAt: new Date(Date.now() + 1000),
        });

        const { data } = await createLogin({ ...baseArgs, otp: "987650" });

        expect(updateOtpConsumed).toHaveBeenCalledWith(
            expect.objectContaining({ id: "otp-1" }),
        );
        expect(data?.user).toEqual({ id: "user-1", phoneNumber });

        // Only the hash of the refresh token is persisted.
        // The session belongs to this device, replacing any session it had.
        expect(insertUserDevice).toHaveBeenCalledWith(
            expect.objectContaining({ deviceId: "device-abc-123", platform: "ios" }),
        );
        expect(updateDeviceSessionsRevoked).toHaveBeenCalledWith(
            expect.objectContaining({ userDeviceId: "ud-1", revokedReason: "replaced_by_login" }),
        );
        expect(insertSession).toHaveBeenCalledWith(expect.objectContaining({ userDeviceId: "ud-1" }));

        const { tokenHash } = jest.mocked(insertRefreshToken).mock.calls[0][0];
        expect(tokenHash).toBe(hashToken({ token: data!.refreshToken }));
        expect(tokenHash).not.toBe(data!.refreshToken);

        const claims = jwt.verify(data!.accessToken, process.env.JWT_ACCESS_SECRET!, {
            algorithms: ["HS256"],
            issuer: "doviz-api",
            audience: "doviz-app",
        }) as jwt.JwtPayload;
        expect(claims.sub).toBe("user-1");
        expect(claims.sid).toBe("session-1");
        expect(auditActions()).toEqual(["user.registered", "security.device.trusted", "auth.login.succeeded"]);

        // Nothing secret ever reaches the audit log.
        const logged = JSON.stringify(jest.mocked(createAuditLog).mock.calls);
        expect(logged).not.toContain("987650");
        expect(logged).not.toContain(data!.refreshToken);
        expect(logged).not.toContain(data!.accessToken);
    });
});
