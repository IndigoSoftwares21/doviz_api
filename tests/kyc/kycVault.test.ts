import { randomBytes } from "crypto";
import { createEnvKycKeyring } from "@/services/kycVault/kycKeyring";
import sealKyc from "@/services/kycVault/sealKyc";
import openKyc from "@/services/kycVault/openKyc";
import bvnIndex from "@/services/kycVault/bvnIndex";
import { KycDetails } from "@/services/kycVault/types";

const key = () => randomBytes(32).toString("base64");
const V1 = key();
const keyring = createEnvKycKeyring({ env: { KYC_ENCRYPTION_KEYS: `1:${V1}`, KYC_ENCRYPTION_KEY_VERSION: "1" } });
const USER = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const OTHER = "0b6c3a3e-1f2d-4c5b-8a9e-2d4f6a8b0c1d";
const details: KycDetails = {
    bvn: "22212345678",
    firstName: "Adéṣọlá",
    middleName: null,
    lastName: "Okafor-Eze",
    dateOfBirth: "1994-03-18",
    gender: "female",
    address: "12 Allen Avenue, Ikeja, Lagos",
};

describe("KYC vault", () => {
    it("round-trips every field, and stores none of them readably", () => {
        const sealed = sealKyc({ userId: USER, details, keyring });
        expect(openKyc({ userId: USER, sealed, keyring })).toEqual(details);
        const stored = JSON.stringify(sealed);
        for (const value of [details.bvn, details.lastName, details.dateOfBirth, details.address, "Ikeja", "1994"]) expect(stored).not.toContain(value);
    });

    it("encrypts the same details differently every time (fresh key and IVs)", () => {
        const a = sealKyc({ userId: USER, details, keyring });
        const b = sealKyc({ userId: USER, details, keyring });
        expect(a.bvnEnc).not.toBe(b.bvnEnc);
        expect(a.wrappedKey).not.toBe(b.wrappedKey);
    });

    it("refuses a record that was altered", () => {
        const sealed = sealKyc({ userId: USER, details, keyring });
        const [format, iv, tag, body] = sealed.bvnEnc.split(".");
        const flipped = Buffer.from(body, "base64url");
        flipped[0] ^= 1;
        const tampered = { ...sealed, bvnEnc: [format, iv, tag, flipped.toString("base64url")].join(".") };
        expect(() => openKyc({ userId: USER, sealed: tampered, keyring })).toThrow();
    });

    it("refuses a record moved to another user, or a field moved to another column", () => {
        const sealed = sealKyc({ userId: USER, details, keyring });
        expect(() => openKyc({ userId: OTHER, sealed, keyring })).toThrow();
        expect(() => openKyc({ userId: USER, sealed: { ...sealed, addressEnc: sealed.bvnEnc }, keyring })).toThrow();
    });

    it("can't be opened with a different master key", () => {
        const sealed = sealKyc({ userId: USER, details, keyring });
        const stranger = createEnvKycKeyring({ env: { KYC_ENCRYPTION_KEYS: `1:${key()}`, KYC_ENCRYPTION_KEY_VERSION: "1" } });
        expect(() => openKyc({ userId: USER, sealed, keyring: stranger })).toThrow();
    });

    it("keeps old records readable after the master key is rotated", () => {
        const old = sealKyc({ userId: USER, details, keyring });
        const rotated = createEnvKycKeyring({ env: { KYC_ENCRYPTION_KEYS: `1:${V1},2:${key()}`, KYC_ENCRYPTION_KEY_VERSION: "2" } });
        const fresh = sealKyc({ userId: USER, details, keyring: rotated });
        expect(fresh.keyVersion).toBe(2);
        expect(openKyc({ userId: USER, sealed: old, keyring: rotated })).toEqual(details);
        expect(openKyc({ userId: USER, sealed: fresh, keyring: rotated })).toEqual(details);
    });

    it.each([
        [{ KYC_ENCRYPTION_KEYS: "", KYC_ENCRYPTION_KEY_VERSION: "1" }],
        [{ KYC_ENCRYPTION_KEYS: `1:${randomBytes(16).toString("base64")}`, KYC_ENCRYPTION_KEY_VERSION: "1" }],
        [{ KYC_ENCRYPTION_KEYS: `1:${V1}`, KYC_ENCRYPTION_KEY_VERSION: "2" }],
        [{ KYC_ENCRYPTION_KEYS: `x:${V1}`, KYC_ENCRYPTION_KEY_VERSION: "1" }],
    ])("refuses to start with missing or malformed keys (%#)", (env) => {
        expect(() => createEnvKycKeyring({ env })).toThrow();
    });

    it("fingerprints a BVN consistently, per key, without revealing it", () => {
        const env = { KYC_BVN_INDEX_KEY: key() };
        const index = bvnIndex({ bvn: details.bvn, env });
        expect(index).toMatch(/^[0-9a-f]{64}$/);
        expect(bvnIndex({ bvn: details.bvn, env })).toBe(index);
        expect(bvnIndex({ bvn: "22212345679", env })).not.toBe(index);
        expect(bvnIndex({ bvn: details.bvn, env: { KYC_BVN_INDEX_KEY: key() } })).not.toBe(index);
        expect(() => bvnIndex({ bvn: details.bvn, env: {} })).toThrow();
    });
});
