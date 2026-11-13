import { createHmac } from "crypto";

/**
 * A keyed fingerprint of an identifier's value (BVN, NIN…): HMAC-SHA256 with
 * its own key — never the encryption key — and the field name mixed in, so the
 * same digits as a BVN and as a NIN don't match. Lets us check "is this BVN
 * already on Ziks?" without decrypting; can't be reversed without the key.
 */
const kycLookupIndex = ({ fieldKey, value, env = process.env }: { fieldKey: string; value: string; env?: NodeJS.ProcessEnv }) => {
    const key = Buffer.from(env.KYC_BVN_INDEX_KEY ?? "", "base64");
    if (key.length < 32) throw new Error("KYC_BVN_INDEX_KEY must be base64 of at least 32 bytes");
    return createHmac("sha256", key).update(`${fieldKey}:${value}`, "utf8").digest("hex");
};

export default kycLookupIndex;
