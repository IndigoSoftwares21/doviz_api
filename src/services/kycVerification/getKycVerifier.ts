import { KycVerifier } from "./kycVerifier";
import IdentifyOrgClient from "./providers/identifyorg/identifyOrgClient";
import IdentifyOrgKycVerifier from "./providers/identifyorg/identifyOrgKycVerifier";

let verifier: KycVerifier | null = null;

/** The active KYC verifier (KYC_VERIFIER, default "identifyorg"); throws if it isn't configured. */
const getKycVerifier = (): KycVerifier => {
    if (verifier) return verifier;
    const name = process.env.KYC_VERIFIER || "identifyorg";
    if (name !== "identifyorg") throw new Error(`KYC verifier "${name}" is not available`);
    const key = process.env.IDENTIFYORG_API_KEY;
    if (!key) throw new Error("IDENTIFYORG_API_KEY is not set");
    verifier = new IdentifyOrgKycVerifier(new IdentifyOrgClient(key));
    return verifier;
};

/** Tests only. */
export const setKycVerifier = (next: KycVerifier | null) => {
    verifier = next;
};

export default getKycVerifier;
