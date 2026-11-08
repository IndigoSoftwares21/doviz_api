import { generateKeyPairSync, sign } from "crypto";
import createBiometricVerification from "@/actions/biometricVerification/createBiometricVerification";
import selectLiveBiometricChallenge from "@/actions/biometricVerification/createBiometricVerification/queries/selectLiveBiometricChallenge";
import updateBiometricChallengeConsumed from "@/actions/biometricVerification/createBiometricVerification/queries/updateBiometricChallengeConsumed";
import selectActiveBiometricKeyById from "@/actions/biometricVerification/createBiometricVerification/queries/selectActiveBiometricKeyById";
import updateBiometricKeyLastUsed from "@/actions/biometricVerification/createBiometricVerification/queries/updateBiometricKeyLastUsed";
import createAuditLog from "@/actions/auditLog/createAuditLog";

jest.mock("@/database", () => ({
    withTransaction: (callback: (trx: unknown) => unknown) => callback({}),
}));
jest.mock("@/actions/biometricVerification/createBiometricVerification/queries/selectLiveBiometricChallenge");
jest.mock("@/actions/biometricVerification/createBiometricVerification/queries/updateBiometricChallengeConsumed");
jest.mock("@/actions/biometricVerification/createBiometricVerification/queries/selectActiveBiometricKeyById");
jest.mock("@/actions/biometricVerification/createBiometricVerification/queries/updateBiometricKeyLastUsed");
jest.mock("@/actions/auditLog/createAuditLog");

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const publicKeyBase64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
const challenge = "q1V3t6mY0Yx8b2l0c0p1dGgyM2FiY2RlZmdoaWprbG0";
const signed = (message: string) =>
    sign("sha256", Buffer.from(message), { key: privateKey, dsaEncoding: "der" }).toString("base64");
const args = (signature: string) => ({
    userId: "user-1",
    challengeId: "11111111-1111-4111-8111-111111111111",
    signature,
    purpose: "verification" as const,
    deviceId: "device-abc-123",
    ipAddress: "1.2.3.4",
    userAgent: "jest",
});
const failureReasons = () =>
    jest.mocked(createAuditLog).mock.calls.map(([call]) => (call.metadata as { reason?: string })?.reason);

describe("createBiometricVerification", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectLiveBiometricChallenge).mockResolvedValue({ id: "challenge-1", challenge, biometricKeyId: "key-1" });
        jest.mocked(selectActiveBiometricKeyById).mockResolvedValue({ id: "key-1", deviceId: "device-abc-123", publicKey: publicKeyBase64 });
    });

    it("verifies a valid signature and records the device as used", async () => {
        const { data } = await createBiometricVerification(args(signed(challenge)));

        expect(data).toEqual({ verified: true, deviceId: "device-abc-123" });
        expect(updateBiometricChallengeConsumed).toHaveBeenCalled();
        expect(updateBiometricKeyLastUsed).toHaveBeenCalledWith(expect.objectContaining({ id: "key-1" }));
    });

    it("burns the challenge even when the signature is wrong", async () => {
        const { data } = await createBiometricVerification(args(signed("different")));

        expect(data).toBeNull();
        expect(updateBiometricChallengeConsumed).toHaveBeenCalled();
        expect(updateBiometricKeyLastUsed).not.toHaveBeenCalled();
        expect(failureReasons()).toEqual(["invalid_signature"]);
    });

    it("fails for an unknown, expired or already-used challenge", async () => {
        jest.mocked(selectLiveBiometricChallenge).mockResolvedValue(undefined);

        const { data } = await createBiometricVerification(args(signed(challenge)));

        expect(data).toBeNull();
        expect(failureReasons()).toEqual(["no_live_challenge"]);
    });

    it("only accepts a challenge issued for the same purpose", async () => {
        await createBiometricVerification({ ...args(signed(challenge)), purpose: "login" });

        expect(selectLiveBiometricChallenge).toHaveBeenCalledWith(expect.objectContaining({ purpose: "login" }));
    });

    it("rejects a signature from a different device than the session's", async () => {
        const { data } = await createBiometricVerification({ ...args(signed(challenge)), deviceId: "other-device-999" });

        expect(data).toBeNull();
        expect(failureReasons()).toEqual(["device_mismatch"]);
    });

    it("fails when the device key was revoked after the challenge was issued", async () => {
        jest.mocked(selectActiveBiometricKeyById).mockResolvedValue(undefined);

        const { data } = await createBiometricVerification(args(signed(challenge)));

        expect(data).toBeNull();
        expect(failureReasons()).toEqual(["key_revoked"]);
    });
});
