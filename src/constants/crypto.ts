/** Crypto deposits → naira balance. Provider names live only in config. */
const CRYPTO = {
    CURRENCY: "NGN",
    /** Provider used for NEW deposit addresses (existing ones keep theirs). */
    DEFAULT_PROVIDER: "breet",
    QUOTE_TTL_SECONDS: 45,
    LABEL_PREFIX: "dvz-",
    /** Withdrawal bounds in naira (provider limits may be stricter). */
    MIN_WITHDRAWAL_NGN: "100",
    MAX_WITHDRAWAL_NGN: "5000000",
    DEPOSIT_STATUSES: ["pending", "flagged", "completed", "deleted"],
    WITHDRAWAL_STATUSES: ["pending", "processing", "completed", "reversed", "rejected", "failed"],
    WITHDRAWAL_FINAL_STATUSES: ["completed", "reversed", "rejected", "failed"],
} as const;

/** Which of a provider's environments its catalog rows (assets, banks) belong to. */
export const PROVIDER_ENVIRONMENT = {
    SANDBOX: "sandbox",
    PRODUCTION: "production",
} as const;

export type ProviderEnvironment = (typeof PROVIDER_ENVIRONMENT)[keyof typeof PROVIDER_ENVIRONMENT];

export type DepositStatus = (typeof CRYPTO.DEPOSIT_STATUSES)[number];
export type WithdrawalStatus = (typeof CRYPTO.WITHDRAWAL_STATUSES)[number];

export default CRYPTO;
