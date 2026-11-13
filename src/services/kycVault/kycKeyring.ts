import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Wraps (encrypts) and unwraps the per-record data keys. The master keys never
 * leave the keyring. Today it reads them from the environment; a KMS-backed
 * keyring (AWS/GCP KMS, Vault) can replace it with no change to stored data
 * beyond re-wrapping — callers only see this interface.
 */
export interface KycKeyring {
    readonly activeVersion: number;
    wrap(args: { dataKey: Buffer; context: string }): { wrappedKey: string; version: number };
    unwrap(args: { wrappedKey: string; version: number; context: string }): Buffer;
}

const KEY_BYTES = 32;
const IV_BYTES = 12;

/**
 * KYC_ENCRYPTION_KEYS = "1:<base64 32 bytes>,2:<base64 32 bytes>" (old versions
 * kept so old records still open); KYC_ENCRYPTION_KEY_VERSION = the one new
 * records use. Rotation: add a version, switch the active one, re-wrap at leisure.
 */
export const createEnvKycKeyring = ({ env = process.env }: { env?: NodeJS.ProcessEnv } = {}): KycKeyring => {
    const keys = new Map<number, Buffer>();
    for (const entry of (env.KYC_ENCRYPTION_KEYS ?? "").split(",").map((part) => part.trim()).filter(Boolean)) {
        const [rawVersion, rawKey] = entry.split(":");
        const version = Number(rawVersion);
        const key = Buffer.from(rawKey ?? "", "base64");
        if (!Number.isInteger(version) || version <= 0 || key.length !== KEY_BYTES) {
            throw new Error("KYC_ENCRYPTION_KEYS is malformed: expected \"<version>:<base64 of 32 bytes>\" entries");
        }
        keys.set(version, key);
    }
    const activeVersion = Number(env.KYC_ENCRYPTION_KEY_VERSION);
    if (!keys.has(activeVersion)) throw new Error("KYC_ENCRYPTION_KEY_VERSION must name a key in KYC_ENCRYPTION_KEYS");

    const keyFor = (version: number) => {
        const key = keys.get(version);
        if (!key) throw new Error(`KYC master key version ${version} is not configured`);
        return key;
    };

    return {
        activeVersion,
        wrap: ({ dataKey, context }) => {
            const iv = randomBytes(IV_BYTES);
            const cipher = createCipheriv("aes-256-gcm", keyFor(activeVersion), iv);
            cipher.setAAD(Buffer.from(context, "utf8"));
            const sealed = Buffer.concat([cipher.update(dataKey), cipher.final()]);
            return { wrappedKey: [iv, cipher.getAuthTag(), sealed].map((part) => part.toString("base64url")).join("."), version: activeVersion };
        },
        unwrap: ({ wrappedKey, version, context }) => {
            const [iv, tag, sealed] = wrappedKey.split(".").map((part) => Buffer.from(part, "base64url"));
            const decipher = createDecipheriv("aes-256-gcm", keyFor(version), iv);
            decipher.setAAD(Buffer.from(context, "utf8"));
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(sealed), decipher.final()]);
        },
    };
};
