import { randomUUID } from "crypto";
import getKycKeyring from "@/services/kycVault/getKycKeyring";
import sealKycValue from "@/services/kycVault/sealKycValue";
import kycLookupIndex from "@/services/kycVault/kycLookupIndex";
import { KYC_FIELDS } from "@/constants/kycFields";

/**
 * Encrypts each submitted value as a new kyc_fields row (outside any DB
 * transaction — it's pure CPU). Identifiers also get their lookup index, and
 * fields that allow it a safe display hint (a BVN's last 4).
 */
const sealSubmittedValues = ({ userId, values }: { userId: string; values: Record<string, string> }) => {
    const keyring = getKycKeyring();
    return Object.entries(values).map(([fieldKey, value]) => {
        const field = KYC_FIELDS[fieldKey];
        const id = randomUUID();
        return {
            id,
            userId,
            fieldKey,
            ...sealKycValue({ userId, fieldKey, rowId: id, value, keyring }),
            lookupIndex: field.identifier ? kycLookupIndex({ fieldKey, value }) : null,
            displayHint: field.displayHint === "last4" ? value.slice(-4) : null,
        };
    });
};

export type SealedKycField = ReturnType<typeof sealSubmittedValues>[number];

export default sealSubmittedValues;
