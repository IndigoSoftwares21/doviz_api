import monitoring from "@/utils/monitoring";
import getKycKeyring from "./getKycKeyring";
import kycLookupIndex from "./kycLookupIndex";

/**
 * Startup check: loads the KYC keys once so a missing or malformed key is
 * reported at boot, not on a user's first submission. Never logs the keys.
 */
const checkKycKeys = () => {
    try {
        getKycKeyring();
        kycLookupIndex({ fieldKey: "bvn", value: "00000000000" });
        return true;
    } catch (error) {
        monitoring.warn(`KYC keys are not usable — identity verification is disabled: ${(error as Error).message}`);
        return false;
    }
};

export default checkKycKeys;
