import request from "supertest";
import app from "../../src/app";
import signAccessToken from "@/utils/auth/signAccessToken";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import createEmailVerification from "@/actions/emailVerification/createEmailVerification";
import createEmailConfirmation from "@/actions/emailConfirmation/createEmailConfirmation";
import selectUserByEmail from "@/schemaHelpers/selectUserByEmail";
import selectLatestEmailVerificationByUser from "@/schemaHelpers/selectLatestEmailVerificationByUser";
import selectEmailVerificationCountByUser from "@/schemaHelpers/selectEmailVerificationCountByUser";

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/actions/emailVerification/createEmailVerification");
jest.mock("@/actions/emailConfirmation/createEmailConfirmation");
jest.mock("@/schemaHelpers/selectUserByEmail");
jest.mock("@/schemaHelpers/selectLatestEmailVerificationByUser");
jest.mock("@/schemaHelpers/selectEmailVerificationCountByUser");

const verificationUrl = "/api/v1/app/auth/email/verification";
const confirmationUrl = "/api/v1/app/auth/email/confirmation";
const authHeader = () =>
    `Bearer ${signAccessToken({ userId: "user-1", sessionId: "session-1" })}`;

describe("email verification routes", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "device-abc-123", accountStatus: "active" });
        jest.mocked(selectUserByEmail).mockResolvedValue(undefined);
        jest.mocked(selectLatestEmailVerificationByUser).mockResolvedValue(undefined);
        jest.mocked(selectEmailVerificationCountByUser).mockResolvedValue({
            emailVerificationCount: "0",
        });
    });

    it("requires authentication", async () => {
        const response = await request(app.express)
            .post(verificationUrl)
            .send({ email: "ada@example.com" });

        expect(response.status).toBe(401);
        expect(createEmailVerification).not.toHaveBeenCalled();
    });

    it("sends a code to a normalised email for the authenticated user", async () => {
        jest.mocked(createEmailVerification).mockResolvedValue({
            data: { email: "ada@example.com", expiresAt: new Date(), resendAvailableAt: new Date() },
        });

        const response = await request(app.express)
            .post(verificationUrl)
            .set("Authorization", authHeader())
            .send({ email: "  Ada@Example.COM " });

        expect(response.status).toBe(201);
        expect(createEmailVerification).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1", email: "ada@example.com" }),
        );
    });

    it("rejects an email already used by another account", async () => {
        jest.mocked(selectUserByEmail).mockResolvedValue({ id: "user-2" });

        const response = await request(app.express)
            .post(verificationUrl)
            .set("Authorization", authHeader())
            .send({ email: "ada@example.com" });

        expect(response.status).toBe(400);
        expect(response.body.validationErrors[0].message).toBe("This email is already in use");
        expect(createEmailVerification).not.toHaveBeenCalled();
    });

    it("enforces the resend cooldown", async () => {
        jest.mocked(selectLatestEmailVerificationByUser).mockResolvedValue({
            id: "ev-1",
            createdAt: new Date(),
        });

        const response = await request(app.express)
            .post(verificationUrl)
            .set("Authorization", authHeader())
            .send({ email: "ada@example.com" });

        expect(response.status).toBe(400);
        expect(createEmailVerification).not.toHaveBeenCalled();
    });

    it("returns 400 (not 401) for a wrong confirmation code", async () => {
        jest.mocked(createEmailConfirmation).mockResolvedValue({ data: null });

        const response = await request(app.express)
            .post(confirmationUrl)
            .set("Authorization", authHeader())
            .send({ otp: "123456" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Invalid or expired verification code");
    });

    it("confirms the email", async () => {
        jest.mocked(createEmailConfirmation).mockResolvedValue({
            data: { id: "user-1", email: "ada@example.com", emailVerifiedAt: new Date() },
        });

        const response = await request(app.express)
            .post(confirmationUrl)
            .set("Authorization", authHeader())
            .send({ otp: "123456" });

        expect(response.status).toBe(200);
        expect(response.body.data.email).toBe("ada@example.com");
    });
});
