import request from "supertest";
import app from "../../src/app";
import createOtp from "@/actions/otp/createOtp";
import createLogin from "@/actions/login/createLogin";
import selectLatestOtpByPhone from "@/schemaHelpers/selectLatestOtpByPhone";
import selectOtpCountByPhone from "@/schemaHelpers/selectOtpCountByPhone";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/actions/otp/createOtp");
jest.mock("@/actions/login/createLogin");
jest.mock("@/schemaHelpers/selectLatestOtpByPhone");
jest.mock("@/schemaHelpers/selectOtpCountByPhone");

const otpUrl = "/api/v1/app/auth/otp";
const loginUrl = "/api/v1/app/auth/login";

describe("POST /auth/otp", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectLatestOtpByPhone).mockResolvedValue(undefined);
        jest.mocked(selectOtpCountByPhone).mockResolvedValue({ otpCount: "0" });
    });

    it("sends a code to a normalised E.164 number and never returns it", async () => {
        jest.mocked(createOtp).mockResolvedValue({
            data: { expiresAt: new Date(), resendAvailableAt: new Date() },
        });

        const response = await request(app.express)
            .post(otpUrl)
            .send({ phoneNumber: "+234 801 234 5678" });

        expect(response.status).toBe(201);
        expect(createOtp).toHaveBeenCalledWith(
            expect.objectContaining({ phoneNumber: "+2348012345678" }),
        );
        expect(Object.keys(response.body.data).sort()).toEqual([
            "expiresAt",
            "resendAvailableAt",
        ]);
    });

    it("rejects a non-international number without touching the DB", async () => {
        const response = await request(app.express)
            .post(otpUrl)
            .send({ phoneNumber: "08012345678" });

        expect(response.status).toBe(400);
        expect(selectLatestOtpByPhone).not.toHaveBeenCalled();
        expect(createOtp).not.toHaveBeenCalled();
    });

    it("enforces the resend cooldown", async () => {
        jest.mocked(selectLatestOtpByPhone).mockResolvedValue({
            id: "otp-1",
            createdAt: new Date(),
        });

        const response = await request(app.express)
            .post(otpUrl)
            .send({ phoneNumber: "+2348012345678" });

        expect(response.status).toBe(400);
        expect(response.body.validationErrors[0].message).toMatch(/wait/);
        expect(createOtp).not.toHaveBeenCalled();
    });

    it("enforces the hourly request limit", async () => {
        jest.mocked(selectOtpCountByPhone).mockResolvedValue({ otpCount: "5" });

        const response = await request(app.express)
            .post(otpUrl)
            .send({ phoneNumber: "+2348012345678" });

        expect(response.status).toBe(400);
        expect(createOtp).not.toHaveBeenCalled();
    });
});

describe("POST /auth/login", () => {
    beforeEach(() => jest.resetAllMocks());

    it("returns a generic 401 for a bad or expired code", async () => {
        jest.mocked(createLogin).mockResolvedValue({ data: null });

        const response = await request(app.express)
            .post(loginUrl)
            .send({ phoneNumber: "+2348012345678", otp: "123456", deviceId: "device-abc-123" });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid or expired verification code");
    });

    it("requires a device ID", async () => {
        const response = await request(app.express)
            .post(loginUrl)
            .send({ phoneNumber: "+2348012345678", otp: "123456" });

        expect(response.status).toBe(400);
        expect(response.body.validationErrors[0].path).toEqual(["deviceId"]);
        expect(createLogin).not.toHaveBeenCalled();
    });

    it("rejects a malformed code before verification", async () => {
        const response = await request(app.express)
            .post(loginUrl)
            .send({ phoneNumber: "+2348012345678", otp: "12ab", deviceId: "device-abc-123" });

        expect(response.status).toBe(400);
        expect(createLogin).not.toHaveBeenCalled();
    });

    it("returns tokens with Cache-Control: no-store on success", async () => {
        jest.mocked(createLogin).mockResolvedValue({
            data: {
                accessToken: "access",
                accessTokenExpiresAt: new Date(),
                refreshToken: "refresh",
                refreshTokenExpiresAt: new Date(),
                user: { id: "user-1", phoneNumber: "+2348012345678" },
            },
        });

        const response = await request(app.express)
            .post(loginUrl)
            .send({ phoneNumber: "+2348012345678", otp: "123456", deviceId: "device-abc-123" });

        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(response.body.data.accessToken).toBe("access");
    });
});
