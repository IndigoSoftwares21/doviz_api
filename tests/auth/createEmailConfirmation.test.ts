import createEmailConfirmation from "@/actions/emailConfirmation/createEmailConfirmation";
import hashOtp from "@/utils/auth/hashOtp";
import getEmailOtpSubject from "@/utils/auth/getEmailOtpSubject";
import selectLiveEmailVerification from "@/actions/emailConfirmation/createEmailConfirmation/queries/selectLiveEmailVerification";
import updateEmailVerificationAttempts from "@/actions/emailConfirmation/createEmailConfirmation/queries/updateEmailVerificationAttempts";
import updateEmailVerificationConsumed from "@/actions/emailConfirmation/createEmailConfirmation/queries/updateEmailVerificationConsumed";
import updateUserEmail from "@/actions/emailConfirmation/createEmailConfirmation/queries/updateUserEmail";
import createAuditLog from "@/actions/auditLog/createAuditLog";

process.env.OTP_PEPPER = "test-pepper-test-pepper-test-pepper-0001";

jest.mock("@/database", () => ({
    withTransaction: (callback: (trx: unknown) => unknown) => callback({}),
}));
jest.mock("@/actions/emailConfirmation/createEmailConfirmation/queries/selectLiveEmailVerification");
jest.mock("@/actions/emailConfirmation/createEmailConfirmation/queries/updateEmailVerificationAttempts");
jest.mock("@/actions/emailConfirmation/createEmailConfirmation/queries/updateEmailVerificationConsumed");
jest.mock("@/actions/emailConfirmation/createEmailConfirmation/queries/updateUserEmail");
jest.mock("@/actions/auditLog/createAuditLog");

const userId = "user-1";
const email = "ada@example.com";
const verificationRow = (overrides = {}) => ({
    id: "ev-1",
    email,
    codeHash: hashOtp({ subject: getEmailOtpSubject({ userId, email }), otp: "654321" }),
    attempts: 0,
    maxAttempts: 5,
    ...overrides,
});
const baseArgs = { userId, ipAddress: "1.2.3.4", userAgent: "jest" };
const auditActions = () => jest.mocked(createAuditLog).mock.calls.map(([args]) => args.action);

describe("createEmailConfirmation", () => {
    beforeEach(() => jest.resetAllMocks());

    it("fails with no live code", async () => {
        jest.mocked(selectLiveEmailVerification).mockResolvedValue(undefined);

        const { data } = await createEmailConfirmation({ ...baseArgs, otp: "654321" });

        expect(data).toBeNull();
        expect(updateUserEmail).not.toHaveBeenCalled();
        expect(auditActions()).toEqual(["user.email.verification_failed"]);
    });

    it("counts a wrong code and locks on the last attempt", async () => {
        jest.mocked(selectLiveEmailVerification).mockResolvedValue(verificationRow({ attempts: 4 }));

        const { data } = await createEmailConfirmation({ ...baseArgs, otp: "000000" });

        expect(data).toBeNull();
        expect(updateEmailVerificationAttempts).toHaveBeenCalledWith(
            expect.objectContaining({ attempts: 5, revokedAt: expect.any(Date) }),
        );
        expect(auditActions()).toEqual(["user.email.verification_locked"]);
    });

    it("does not accept a code issued to a different user", async () => {
        jest.mocked(selectLiveEmailVerification).mockResolvedValue(
            verificationRow({
                codeHash: hashOtp({
                    subject: getEmailOtpSubject({ userId: "someone-else", email }),
                    otp: "654321",
                }),
            }),
        );

        const { data } = await createEmailConfirmation({ ...baseArgs, otp: "654321" });

        expect(data).toBeNull();
    });

    it("consumes the code and sets the verified email", async () => {
        jest.mocked(selectLiveEmailVerification).mockResolvedValue(verificationRow());
        const verifiedAt = new Date();
        jest.mocked(updateUserEmail).mockResolvedValue({ id: userId, email, emailVerifiedAt: verifiedAt });

        const { data } = await createEmailConfirmation({ ...baseArgs, otp: "654321" });

        expect(updateEmailVerificationConsumed).toHaveBeenCalledWith(
            expect.objectContaining({ id: "ev-1" }),
        );
        expect(updateUserEmail).toHaveBeenCalledWith(expect.objectContaining({ userId, email }));
        expect(data).toEqual({ id: userId, email, emailVerifiedAt: verifiedAt });
        expect(auditActions()).toEqual(["user.email.verified"]);
    });
});
