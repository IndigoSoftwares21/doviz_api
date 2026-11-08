import createPinReset from "@/actions/pinReset/createPinReset";
import hashOtp from "@/utils/auth/hashOtp";
import selectUserPhoneForReset from "@/actions/pinReset/createPinReset/queries/selectUserPhoneForReset";
import updateBiometricKeysRevoked from "@/actions/pinReset/createPinReset/queries/updateBiometricKeysRevoked";
import selectLiveOtp from "@/actions/login/createLogin/queries/selectLiveOtp";
import updateOtpAttempts from "@/actions/login/createLogin/queries/updateOtpAttempts";
import updateOtpConsumed from "@/actions/login/createLogin/queries/updateOtpConsumed";
import updatePinHash from "@/actions/pin/modifyPin/queries/updatePinHash";
import createAuditLog from "@/actions/auditLog/createAuditLog";

process.env.OTP_PEPPER = "test-pepper-test-pepper-test-pepper-0001";
process.env.PIN_PEPPER = "test-pin-pepper-test-pin-pepper-test-0001";

jest.mock("@/database", () => ({
    withTransaction: (callback: (trx: unknown) => unknown) => callback({}),
}));
jest.mock("@/actions/pinReset/createPinReset/queries/selectUserPhoneForReset");
jest.mock("@/actions/pinReset/createPinReset/queries/updateBiometricKeysRevoked");
jest.mock("@/actions/login/createLogin/queries/selectLiveOtp");
jest.mock("@/actions/login/createLogin/queries/updateOtpAttempts");
jest.mock("@/actions/login/createLogin/queries/updateOtpConsumed");
jest.mock("@/actions/pin/modifyPin/queries/updatePinHash");
jest.mock("@/actions/auditLog/createAuditLog");

const phoneNumber = "+2348012345678";
const args = (otp: string) => ({ userId: "user-1", otp, newPin: "9361", ipAddress: "1.2.3.4", userAgent: "jest" });
const otpRow = (subject: string) => ({
    id: "otp-1",
    codeHash: hashOtp({ subject, otp: "482913" }),
    attempts: 0,
    maxAttempts: 5,
});

describe("createPinReset", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectUserPhoneForReset).mockResolvedValue({ id: "user-1", phoneNumber });
    });

    it("looks up only pin_reset codes", async () => {
        jest.mocked(selectLiveOtp).mockResolvedValue(undefined);

        await createPinReset(args("482913"));

        expect(selectLiveOtp).toHaveBeenCalledWith(expect.objectContaining({ phoneNumber, purpose: "pin_reset" }));
    });

    it("rejects a login code replayed as a reset code", async () => {
        jest.mocked(selectLiveOtp).mockResolvedValue(otpRow(phoneNumber)); // login-style subject

        const { data } = await createPinReset(args("482913"));

        expect(data).toBeNull();
        expect(updatePinHash).not.toHaveBeenCalled();
        expect(updateOtpAttempts).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1 }));
    });

    it("resets the PIN and turns biometrics off everywhere", async () => {
        jest.mocked(selectLiveOtp).mockResolvedValue(otpRow(`pin_reset:${phoneNumber}`));
        jest.mocked(updateBiometricKeysRevoked).mockResolvedValue([
            { id: "key-1", deviceId: "device-aaa-111" },
            { id: "key-2", deviceId: "device-bbb-222" },
        ]);

        const { data } = await createPinReset(args("482913"));

        expect(data).toEqual({ pinResetAt: expect.any(Date), biometricDevicesRevoked: 2 });
        expect(updateOtpConsumed).toHaveBeenCalled();
        expect(updatePinHash).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", pinHash: expect.stringMatching(/^\$2/) }));
        expect(createAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "security.pin.reset",
                metadata: { biometricDevicesRevoked: ["device-aaa-111", "device-bbb-222"] },
            }),
        );
    });
});
