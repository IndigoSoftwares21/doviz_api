import { randomBytes, randomUUID } from "crypto";
import { createEnvKycKeyring } from "@/services/kycVault/kycKeyring";
import sealKycValue from "@/services/kycVault/sealKycValue";
import openKycValue from "@/services/kycVault/openKycValue";
import kycLookupIndex from "@/services/kycVault/kycLookupIndex";

const key = () => randomBytes(32).toString("base64");
const V1 = key();
const keyring = createEnvKycKeyring({ env: { KYC_ENCRYPTION_KEYS: `1:${V1}`, KYC_ENCRYPTION_KEY_VERSION: "1" } });
const USER = randomUUID();
const ROW = randomUUID();
const BVN = "22212345678";
const at = { userId: USER, fieldKey: "bvn", rowId: ROW };

describe("KYC vault", () => {
    it("round-trips a value without storing it readably", () => {
        const sealed = sealKycValue({ ...at, value: BVN, keyring });
        expect(openKycValue({ ...at, sealed, keyring })).toBe(BVN);
        expect(JSON.stringify(sealed)).not.toContain(BVN);
    });

    it("encrypts the same value differently every time (fresh data key and IV)", () => {
        const a = sealKycValue({ ...at, value: BVN, keyring });
        const b = sealKycValue({ ...at, value: BVN, keyring });
        expect(a.valueEnc).not.toBe(b.valueEnc);
        expect(a.wrappedKey).not.toBe(b.wrappedKey);
    });

    it("refuses a value that was altered", () => {
        const sealed = sealKycValue({ ...at, value: BVN, keyring });
        const [format, iv, tag, body] = sealed.valueEnc.split(".");
        const flipped = Buffer.from(body, "base64url");
        flipped[0] ^= 1;
        expect(() => openKycValue({ ...at, sealed: { ...sealed, valueEnc: [format, iv, tag, flipped.toString("base64url")].join(".") }, keyring })).toThrow();
    });

    it.each([
        ["another user", { userId: randomUUID() }],
        ["another field", { fieldKey: "nin" }],
        ["another row (an older version)", { rowId: randomUUID() }],
    ])("refuses a value moved to %s", (_where, moved) => {
        const sealed = sealKycValue({ ...at, value: BVN, keyring });
        expect(() => openKycValue({ ...at, ...moved, sealed, keyring })).toThrow();
    });

    it("can't be opened with a different master key", () => {
        const sealed = sealKycValue({ ...at, value: BVN, keyring });
        const stranger = createEnvKycKeyring({ env: { KYC_ENCRYPTION_KEYS: `1:${key()}`, KYC_ENCRYPTION_KEY_VERSION: "1" } });
        expect(() => openKycValue({ ...at, sealed, keyring: stranger })).toThrow();
    });

    it("keeps old values readable after the master key is rotated", () => {
        const old = sealKycValue({ ...at, value: BVN, keyring });
        const rotated = createEnvKycKeyring({ env: { KYC_ENCRYPTION_KEYS: `1:${V1},2:${key()}`, KYC_ENCRYPTION_KEY_VERSION: "2" } });
        const fresh = sealKycValue({ ...at, value: BVN, keyring: rotated });
        expect(fresh.keyVersion).toBe(2);
        expect(openKycValue({ ...at, sealed: old, keyring: rotated })).toBe(BVN);
        expect(openKycValue({ ...at, sealed: fresh, keyring: rotated })).toBe(BVN);
    });

    it.each([
        [{ KYC_ENCRYPTION_KEYS: "", KYC_ENCRYPTION_KEY_VERSION: "1" }],
        [{ KYC_ENCRYPTION_KEYS: `1:${randomBytes(16).toString("base64")}`, KYC_ENCRYPTION_KEY_VERSION: "1" }],
        [{ KYC_ENCRYPTION_KEYS: `1:${V1}`, KYC_ENCRYPTION_KEY_VERSION: "2" }],
        [{ KYC_ENCRYPTION_KEYS: `x:${V1}`, KYC_ENCRYPTION_KEY_VERSION: "1" }],
    ])("refuses to start with missing or malformed keys (%#)", (env) => {
        expect(() => createEnvKycKeyring({ env })).toThrow();
    });

    it("fingerprints identifiers per field and per key, without revealing them", () => {
        const env = { KYC_BVN_INDEX_KEY: key() };
        const index = kycLookupIndex({ fieldKey: "bvn", value: BVN, env });
        expect(index).toMatch(/^[0-9a-f]{64}$/);
        expect(kycLookupIndex({ fieldKey: "bvn", value: BVN, env })).toBe(index);
        expect(kycLookupIndex({ fieldKey: "nin", value: BVN, env })).not.toBe(index);
        expect(kycLookupIndex({ fieldKey: "bvn", value: BVN, env: { KYC_BVN_INDEX_KEY: key() } })).not.toBe(index);
        expect(() => kycLookupIndex({ fieldKey: "bvn", value: BVN, env: {} })).toThrow();
    });
});
