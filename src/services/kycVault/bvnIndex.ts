import { createHmac } from "crypto";

/**
 * A keyed fingerprint of a BVN (HMAC-SHA256, its own key — never the
 * encryption key), so a BVN can be checked for reuse without decrypting
 * anything. Without the key it can't be reversed by trying every BVN.
 */
const bvnIndex = ({ bvn, env = process.env }: { bvn: string; env?: NodeJS.ProcessEnv }) => {
    const key = Buffer.from(env.KYC_BVN_INDEX_KEY ?? "", "base64");
    if (key.length < 32) throw new Error("KYC_BVN_INDEX_KEY must be base64 of at least 32 bytes");
    return createHmac("sha256", key).update(bvn, "utf8").digest("hex");
};

export default bvnIndex;
