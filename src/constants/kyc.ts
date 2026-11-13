/** KYC verification attempts. Values match the kyc_records CHECK constraints. */
export const KYC_STATUS = {
    PENDING: "pending",
    VERIFIED: "verified",
    REJECTED: "rejected",
    /** Was verified; replaced by a newer verification (e.g. an upgrade). */
    SUPERSEDED: "superseded",
} as const;

/**
 * How strongly a user is verified: `bvn` = BVN details matched (names, date
 * of birth, and the user's verified phone); `bvn_selfie` = plus the selfie
 * matched to the official BVN photo (what new users get); `bvn_liveness` =
 * plus a liveness check (planned).
 */
export const KYC_LEVEL = {
    BVN: "bvn",
    BVN_SELFIE: "bvn_selfie",
    BVN_LIVENESS: "bvn_liveness",
} as const;

/** The app_settings key that picks the level new verifications use. */
export const KYC_LEVEL_SETTING = "kyc_level";

/** Used when the setting is missing or names a level with no form. */
export const DEFAULT_KYC_LEVEL = KYC_LEVEL.BVN;

export const KYC_MESSAGES = {
    ALREADY_VERIFIED: "You're already verified.",
    IN_REVIEW: "Your details are being checked. We'll let you know shortly.",
    UNAVAILABLE: "We couldn't check your details right now. Please try again.",
    identifierInUse: (label: string) => `This ${label} is already linked to another Ziks account.`,
} as const;

export type KycStatus = (typeof KYC_STATUS)[keyof typeof KYC_STATUS];
export type KycLevel = (typeof KYC_LEVEL)[keyof typeof KYC_LEVEL];

