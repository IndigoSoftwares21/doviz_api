import { KYC_OUTCOME, KycVerification } from "../../kycVerifier";
import { KorapayBvnRecord } from "./korapayIdentityTypes";

const REASONS = {
    name: "Your name doesn't match your BVN. Enter it exactly as it is on your BVN.",
    dateOfBirth: "Your date of birth doesn't match your BVN.",
    gender: "Your gender doesn't match your BVN.",
    selfie: "Your selfie doesn't match your BVN photo. Try again in good light, facing the camera.",
};

const confidence = (value: number | string | null | undefined) => {
    const parsed = Number(value);
    return value === null || value === undefined || Number.isNaN(parsed) ? null : parsed;
};

/**
 * Korapay's BVN record → our decision. Verified only when every check we asked
 * for came back a match; the first mismatch (in the order a person can fix
 * them) is the reason. A missing match result counts as no match.
 */
const decideKorapayBvn = ({ record, gender, withSelfie }: { record: KorapayBvnRecord; gender: string; withSelfie: boolean }): KycVerification => {
    const checks = record.validation ?? {};
    const evidence = {
        firstName: checks.first_name?.match === true,
        lastName: checks.last_name?.match === true,
        dateOfBirth: checks.date_of_birth?.match === true,
        gender: (record.gender ?? "").trim().toLowerCase() === gender.toLowerCase(),
        selfie: withSelfie ? checks.selfie?.match === true : null,
        selfieConfidence: withSelfie ? confidence(checks.selfie?.confidence_rating) : null,
    };

    const reason =
        !evidence.firstName || !evidence.lastName ? REASONS.name
        : !evidence.dateOfBirth ? REASONS.dateOfBirth
        : !evidence.gender ? REASONS.gender
        : withSelfie && !evidence.selfie ? REASONS.selfie
        : null;

    return { outcome: reason ? KYC_OUTCOME.REJECTED : KYC_OUTCOME.VERIFIED, reason, reference: record.reference ?? null, evidence };
};

export default decideKorapayBvn;
