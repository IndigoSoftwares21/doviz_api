/** KYC verification attempts. Values match the kyc_records CHECK constraints. */
export const KYC_STATUS = {
    PENDING: "pending",
    VERIFIED: "verified",
    REJECTED: "rejected",
    /** Was verified; replaced by a newer verification (e.g. an upgrade). */
    SUPERSEDED: "superseded",
} as const;

/**
 * How strongly a user is verified. `bvn` = BVN matched by a KYC verifier
 * (current); `bvn_liveness` = plus a selfie/liveness check (planned).
 */
export const KYC_LEVEL = {
    BVN: "bvn",
    BVN_LIVENESS: "bvn_liveness",
} as const;

export const KYC_MESSAGES = {
    ALREADY_VERIFIED: "You're already verified.",
    IN_REVIEW: "Your details are being checked. We'll let you know shortly.",
    identifierInUse: (label: string) => `This ${label} is already linked to another Ziks account.`,
} as const;

export type KycStatus = (typeof KYC_STATUS)[keyof typeof KYC_STATUS];
export type KycLevel = (typeof KYC_LEVEL)[keyof typeof KYC_LEVEL];

