/** KYC. Values match the user_kyc CHECK constraints. */
export const KYC_STATUS = {
    PENDING: "pending",
    VERIFIED: "verified",
    REJECTED: "rejected",
    /** Was verified; replaced by a newer verification (e.g. an upgrade). */
    SUPERSEDED: "superseded",
} as const;

/**
 * How strongly a user is verified. `bvn` = BVN matched by the account
 * provider (current); `bvn_liveness` = plus a selfie/liveness check (planned).
 */
export const KYC_LEVEL = {
    BVN: "bvn",
    BVN_LIVENESS: "bvn_liveness",
} as const;

export const KYC_GENDER = {
    MALE: "male",
    FEMALE: "female",
} as const;

const KYC = {
    BVN_LENGTH: 11,
    MIN_AGE: 18,
    MAX_AGE: 120,
    ADDRESS_MIN_LENGTH: 5,
    ADDRESS_MAX_LENGTH: 200,
} as const;

export const KYC_MESSAGES = {
    ALREADY_VERIFIED: "You're already verified.",
    IN_REVIEW: "Your details are being checked. We'll let you know shortly.",
    BVN_IN_USE: "This BVN is already linked to another Ziks account.",
} as const;

export type KycStatus = (typeof KYC_STATUS)[keyof typeof KYC_STATUS];
export type KycLevel = (typeof KYC_LEVEL)[keyof typeof KYC_LEVEL];
export type KycGender = (typeof KYC_GENDER)[keyof typeof KYC_GENDER];

export default KYC;
