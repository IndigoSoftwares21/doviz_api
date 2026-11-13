import kycLookupIndex from "@/services/kycVault/kycLookupIndex";
import selectAttemptBlockers from "../../queries/selectAttemptBlockers";
import ACTION_FAILURE from "@/constants/actionFailure";
import { KYC_STATUS } from "@/constants/kyc";
import { KYC_FIELDS } from "@/constants/kycFields";

/**
 * Refusals we can see BEFORE paying a verifier: an attempt in review, already
 * verified at this level, or a submitted identifier held by someone else. The
 * attempt's transaction enforces all of these again (this read isn't locked).
 */
const precheckKycAttempt = async ({ userId, level, values }: { userId: string; level: string; values: Record<string, string> }) => {
    const identifiers = Object.entries(values)
        .filter(([key]) => KYC_FIELDS[key]?.identifier)
        .map(([fieldKey, value]) => ({ fieldKey, lookupIndex: kycLookupIndex({ fieldKey, value }) }));
    const { open, claims } = await selectAttemptBlockers({ userId, identifiers });

    if (open.some((record) => record.status === KYC_STATUS.PENDING)) return { failure: ACTION_FAILURE.KYC_IN_REVIEW, fieldKey: null };
    if (open.some((record) => record.status === KYC_STATUS.VERIFIED && record.level === level)) return { failure: ACTION_FAILURE.KYC_ALREADY_VERIFIED, fieldKey: null };
    const taken = claims.find((claim) => claim.userId !== userId);
    if (taken) return { failure: ACTION_FAILURE.KYC_IDENTIFIER_IN_USE, fieldKey: taken.fieldKey };
    return { failure: null, fieldKey: null };
};

export default precheckKycAttempt;
