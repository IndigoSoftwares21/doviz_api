import { KycVerifier } from "./kycVerifier";
import KorapayKycVerifier from "./providers/korapay/korapayKycVerifier";

let verifier: KycVerifier | null = null;

/** The active KYC verifier (KYC_VERIFIER, default "korapay"); throws if it isn't configured. */
const getKycVerifier = (): KycVerifier => {
    if (verifier) return verifier;
    const name = process.env.KYC_VERIFIER || "korapay";
    if (name !== "korapay") throw new Error(`KYC verifier "${name}" is not available`);
    const key = process.env.KORAPAY_IDENTITY_SECRET_KEY || process.env.KORAPAY_SECRET_KEY;
    if (!key) throw new Error("KORAPAY_IDENTITY_SECRET_KEY is not set");
    verifier = new KorapayKycVerifier(key);
    return verifier;
};

/** Tests only. */
export const setKycVerifier = (next: KycVerifier | null) => {
    verifier = next;
};

export default getKycVerifier;
