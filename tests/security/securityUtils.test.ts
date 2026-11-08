import { generateKeyPairSync, sign } from "crypto";
import isWeakPin from "@/utils/auth/isWeakPin";
import hashPin from "@/utils/auth/hashPin";
import verifyPinHash from "@/utils/auth/verifyPinHash";
import parseBiometricPublicKey from "@/utils/auth/parseBiometricPublicKey";
import verifyBiometricSignature from "@/utils/auth/verifyBiometricSignature";
import getPhoneOtpSubject from "@/utils/auth/getPhoneOtpSubject";

process.env.PIN_PEPPER = "test-pin-pepper-test-pin-pepper-test-0001";

const p256 = () => generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const spkiBase64 = (publicKey: ReturnType<typeof p256>["publicKey"]) =>
    publicKey.export({ format: "der", type: "spki" }).toString("base64");

describe("isWeakPin", () => {
    it.each(["0000", "1111", "1234", "4321", "6789", "1212", "2580", "1122"])("rejects %s", (pin) => {
        expect(isWeakPin({ pin })).toBe(true);
    });

    it.each(["4827", "9361", "5039", "7714"])("accepts %s", (pin) => {
        expect(isWeakPin({ pin })).toBe(false);
    });
});

describe("hashPin / verifyPinHash", () => {
    it("stores a bcrypt hash that verifies only the right PIN for the right user", async () => {
        const pinHash = await hashPin({ userId: "user-1", pin: "4827" });

        expect(pinHash).toMatch(/^\$2[aby]\$12\$/);
        expect(pinHash).not.toContain("4827");
        await expect(verifyPinHash({ userId: "user-1", pin: "4827", pinHash })).resolves.toBe(true);
        await expect(verifyPinHash({ userId: "user-1", pin: "4828", pinHash })).resolves.toBe(false);
        await expect(verifyPinHash({ userId: "user-2", pin: "4827", pinHash })).resolves.toBe(false);
    });

    it("needs the pepper: the same PIN under a different pepper doesn't verify", async () => {
        const pinHash = await hashPin({ userId: "user-1", pin: "4827" });
        process.env.PIN_PEPPER = "another-pepper-another-pepper-another-01";

        await expect(verifyPinHash({ userId: "user-1", pin: "4827", pinHash })).resolves.toBe(false);

        process.env.PIN_PEPPER = "test-pin-pepper-test-pin-pepper-test-0001";
    });
});

describe("parseBiometricPublicKey", () => {
    it("accepts a P-256 SPKI key", () => {
        expect(parseBiometricPublicKey({ publicKey: spkiBase64(p256().publicKey) })).not.toBeNull();
    });

    it.each([
        ["an RSA key", () => generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ format: "der", type: "spki" }).toString("base64")],
        ["a P-384 key", () => generateKeyPairSync("ec", { namedCurve: "secp384r1" }).publicKey.export({ format: "der", type: "spki" }).toString("base64")],
        ["garbage base64", () => Buffer.from("not a key").toString("base64")],
        ["non-base64", () => "<script>"],
    ])("rejects %s", (_label, makeKey) => {
        expect(parseBiometricPublicKey({ publicKey: makeKey() })).toBeNull();
    });
});

describe("verifyBiometricSignature", () => {
    const { publicKey, privateKey } = p256();
    const challenge = "q1V3t6mY0Yx8b2l0c0p1dGgyM2FiY2RlZmdoaWprbG0";
    const signatureFor = (message: string) =>
        sign("sha256", Buffer.from(message), { key: privateKey, dsaEncoding: "der" });

    it("accepts a DER signature over the challenge, in base64 or base64url", () => {
        const signature = signatureFor(challenge);

        expect(verifyBiometricSignature({ publicKey: spkiBase64(publicKey), message: challenge, signature: signature.toString("base64") })).toBe(true);
        expect(verifyBiometricSignature({ publicKey: spkiBase64(publicKey), message: challenge, signature: signature.toString("base64url") })).toBe(true);
    });

    it("rejects a signature over a different challenge", () => {
        const signature = signatureFor("some-other-challenge").toString("base64");
        expect(verifyBiometricSignature({ publicKey: spkiBase64(publicKey), message: challenge, signature })).toBe(false);
    });

    it("rejects a signature from another device's key", () => {
        const signature = signatureFor(challenge).toString("base64");
        expect(verifyBiometricSignature({ publicKey: spkiBase64(p256().publicKey), message: challenge, signature })).toBe(false);
    });

    it("rejects junk without throwing", () => {
        expect(verifyBiometricSignature({ publicKey: spkiBase64(publicKey), message: challenge, signature: "AAAA" })).toBe(false);
    });
});

describe("getPhoneOtpSubject", () => {
    it("keeps login codes and PIN reset codes in separate domains", () => {
        expect(getPhoneOtpSubject({ phoneNumber: "+2348012345678", purpose: "login" })).toBe("+2348012345678");
        expect(getPhoneOtpSubject({ phoneNumber: "+2348012345678", purpose: "pin_reset" })).toBe("pin_reset:+2348012345678");
    });
});
