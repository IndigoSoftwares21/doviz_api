import { generateKeyPairSync } from "crypto";
import request from "supertest";
import app from "../../src/app";
import signAccessToken from "@/utils/auth/signAccessToken";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import selectTransactionPinByUser from "@/schemaHelpers/selectTransactionPinByUser";
import createPin from "@/actions/pin/createPin";
import modifyPin from "@/actions/pin/modifyPin";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import createBiometric from "@/actions/biometric/createBiometric";
import removeBiometric from "@/actions/biometric/removeBiometric";
import createBiometricChallenge from "@/actions/biometricChallenge/createBiometricChallenge";

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/schemaHelpers/selectTransactionPinByUser");
jest.mock("@/actions/pin/createPin");
jest.mock("@/actions/pin/modifyPin");
jest.mock("@/actions/pinVerification/createPinVerification");
jest.mock("@/actions/biometric/createBiometric");
jest.mock("@/actions/biometric/removeBiometric");
jest.mock("@/actions/biometricChallenge/createBiometricChallenge");

const auth = () => `Bearer ${signAccessToken({ userId: "user-1", sessionId: "session-1" })}`;
const api = (method: "post" | "put" | "delete", path: string) =>
    request(app.express)[method](`/api/v1/app/auth${path}`).set("Authorization", auth());
const p256Key = () =>
    generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ format: "der", type: "spki" }).toString("base64");
const firstError = (response: request.Response) => response.body.validationErrors?.[0]?.message ?? response.body.message;

describe("transfer PIN routes", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "device-abc-123", accountStatus: "active" });
        jest.mocked(selectTransactionPinByUser).mockResolvedValue(undefined);
    });

    it("requires authentication", async () => {
        const response = await request(app.express).post("/api/v1/app/auth/pin").send({ pin: "4827", confirmPin: "4827" });
        expect(response.status).toBe(401);
    });

    it("sets a PIN", async () => {
        jest.mocked(createPin).mockResolvedValue({ data: { pinSetAt: new Date() } });

        const response = await api("post", "/pin").send({ pin: "4827", confirmPin: "4827" });

        expect(response.status).toBe(201);
        expect(createPin).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", pin: "4827" }));
    });

    it.each([
        ["a weak PIN", { pin: "1234", confirmPin: "1234" }, /too easy to guess/],
        ["mismatched PINs", { pin: "4827", confirmPin: "4828" }, /don't match/],
        ["a 6-digit PIN", { pin: "482791", confirmPin: "482791" }, /4 digits/],
    ])("rejects %s", async (_label, body, message) => {
        const response = await api("post", "/pin").send(body);

        expect(response.status).toBe(400);
        expect(firstError(response)).toMatch(message);
        expect(createPin).not.toHaveBeenCalled();
    });

    it("won't overwrite an existing PIN", async () => {
        jest.mocked(selectTransactionPinByUser).mockResolvedValue({ userId: "user-1", lockedUntil: null });

        const response = await api("post", "/pin").send({ pin: "4827", confirmPin: "4827" });

        expect(response.status).toBe(400);
        expect(firstError(response)).toMatch(/already set/);
    });

    it("shows attempts left on a wrong PIN", async () => {
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "invalid", remainingAttempts: 2 } });

        const response = await api("post", "/pin/verification").send({ pin: "9999" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Incorrect PIN. 2 attempts remaining.");
    });

    it("returns 423 when the PIN is locked", async () => {
        const lockedUntil = new Date(Date.now() + 30 * 60_000);
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "locked", lockedUntil } });

        const response = await api("post", "/pin/verification").send({ pin: "4827" });

        expect(response.status).toBe(423);
        expect(response.body.message).toContain(lockedUntil.toISOString());
    });

    it("rejects a new PIN equal to the current one", async () => {
        const response = await api("put", "/pin").send({ currentPin: "4827", newPin: "4827", confirmPin: "4827" });

        expect(response.status).toBe(400);
        expect(firstError(response)).toMatch(/different/);
        expect(modifyPin).not.toHaveBeenCalled();
    });

    it("refuses to change the PIN when the current one is wrong", async () => {
        jest.mocked(modifyPin).mockResolvedValue({
            data: null,
            verification: { status: "invalid", remainingAttempts: 4 },
        });

        const response = await api("put", "/pin").send({ currentPin: "9999", newPin: "9361", confirmPin: "9361" });

        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/Incorrect PIN/);
    });
});

describe("biometric routes", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "device-abc-123", accountStatus: "active" });
        jest.mocked(selectTransactionPinByUser).mockResolvedValue({ userId: "user-1", lockedUntil: null });
    });

    it("turns biometrics on with a P-256 key and the PIN", async () => {
        jest.mocked(createBiometric).mockResolvedValue({
            data: { id: "key-1", deviceId: "device-abc-123", deviceName: "Ada's iPhone", createdAt: new Date() },
            verification: { status: "verified" },
        });

        const response = await api("post", "/biometrics").send({
            deviceName: "Ada's iPhone",
            publicKey: p256Key(),
            pin: "4827",
        });

        expect(response.status).toBe(201);
        expect(createBiometric).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", deviceId: "device-abc-123" }));
    });

    it("rejects a key that isn't P-256", async () => {
        const rsaKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ format: "der", type: "spki" }).toString("base64");

        const response = await api("post", "/biometrics").send({ publicKey: rsaKey, pin: "4827" });

        expect(response.status).toBe(400);
        expect(firstError(response)).toMatch(/P-256/);
        expect(createBiometric).not.toHaveBeenCalled();
    });

    it("needs a PIN set before biometrics can be turned on", async () => {
        jest.mocked(selectTransactionPinByUser).mockResolvedValue(undefined);

        const response = await api("post", "/biometrics").send({ publicKey: p256Key(), pin: "4827" });

        expect(response.status).toBe(400);
        expect(firstError(response)).toMatch(/Set a transfer PIN/);
    });

    it("blocks enabling with a wrong PIN", async () => {
        jest.mocked(createBiometric).mockResolvedValue({ data: null, verification: { status: "invalid", remainingAttempts: 4 } });

        const response = await api("post", "/biometrics").send({ publicKey: p256Key(), pin: "9999" });

        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/Incorrect PIN/);
    });

    it("turns biometrics off for a device", async () => {
        jest.mocked(removeBiometric).mockResolvedValue({ data: { deviceId: "device-abc-123", enabled: false } });

        const response = await api("delete", "/biometrics/device-abc-123");

        expect(response.status).toBe(200);
        expect(removeBiometric).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", deviceId: "device-abc-123" }));
    });

    it("issues approval challenges for the session's own device only", async () => {
        jest.mocked(createBiometricChallenge).mockResolvedValue({ data: null });

        const response = await api("post", "/biometrics/challenge").send({ deviceId: "someone-elses-device" });

        expect(response.status).toBe(400);
        expect(createBiometricChallenge).toHaveBeenCalledWith({
            userId: "user-1",
            deviceId: "device-abc-123",
            purpose: "verification",
        });
    });
});
