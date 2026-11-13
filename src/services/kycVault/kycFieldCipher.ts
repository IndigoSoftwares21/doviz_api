import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const FORMAT = "g1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * One field, sealed with the record's data key: AES-256-GCM, a fresh random
 * IV every time, and the field's context (user + field name) as authenticated
 * data — so a value copied to another user or another column won't open.
 * Stored as "g1.<iv>.<tag>.<ciphertext>" (base64url).
 */
export const sealField = ({ dataKey, value, context }: { dataKey: Buffer; value: string; context: string }) => {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
    cipher.setAAD(Buffer.from(context, "utf8"));
    const sealed = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [FORMAT, iv, cipher.getAuthTag(), sealed].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
};

/** Opens a sealed field. Throws if it was altered, or belongs to another user/field. */
export const openField = ({ dataKey, sealed, context }: { dataKey: Buffer; sealed: string; context: string }) => {
    const [format, iv, tag, body] = sealed.split(".");
    if (format !== FORMAT || !iv || !tag || body === undefined) throw new Error("Unrecognised sealed KYC field");
    const tagBytes = Buffer.from(tag, "base64url");
    if (tagBytes.length !== TAG_BYTES) throw new Error("Unrecognised sealed KYC field");
    const decipher = createDecipheriv("aes-256-gcm", dataKey, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tagBytes);
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
};
