/** Buying crypto with naira. Values match the DB CHECK constraints. */
const CRYPTO_PURCHASES = {
    CURRENCY: "NGN",
    /** Our own per-purchase limits on the naira total (a provider's minimum send also applies). */
    MIN_TOTAL: "1000.00",
    MAX_TOTAL: "5000000.00",
    /** POST /crypto/buy waits this long for the provider, then answers `pending`. */
    SUBMIT_WAIT_MS: 8 * 1000,
    /** When a new purchase is re-checked with its provider (ms after it's made). */
    FOLLOW_UP_CHECKS_MS: [5_000, 15_000, 30_000, 60_000, 120_000, 300_000],
    /**
     * A purchase whose send outcome is still unknown after this goes to
     * needs_review. Crypto can't be pulled back, so an unknown outcome is
     * never refunded automatically.
     */
    REVIEW_AFTER_MS: 30 * 60 * 1000,
    RECONCILE_MIN_AGE_MS: 60 * 1000,
    RECONCILE_BATCH_SIZE: 50,
    /** A rate lives this long unless set otherwise. */
    DEFAULT_RATE_HOURS: 24,
    /** set-rate refuses a bigger jump from the current rate without --force (typo guard). */
    MAX_RATE_CHANGE_PERCENT: 5,
    /** Provider catalog terms (fee, minimum) are cached this long. */
    SEND_TERMS_CACHE_MS: 5 * 60 * 1000,
} as const;

/**
 * pending      — money held; sent (or about to be sent) to the provider
 * processing   — outcome unclear (timeout / unclear error); checks continue
 * needs_review — can't tell whether the coin left; ops decide (never auto-refunded)
 * completed    — provider confirmed the send; settled
 * failed       — provider confirmed nothing was sent; refunded in full
 */
export const CRYPTO_PURCHASE_STATUS = {
    PENDING: "pending",
    PROCESSING: "processing",
    NEEDS_REVIEW: "needs_review",
    COMPLETED: "completed",
    FAILED: "failed",
} as const;

/** What a provider says about a send, once mapped. */
export const PROVIDER_SEND_STATUS = {
    PENDING: "pending",
    COMPLETED: "completed",
    FAILED: "failed",
} as const;

/** Same meanings as the payout / bill provider error codes. */
export const CRYPTO_SEND_ERROR_CODE = {
    /** The provider refused it; nothing was sent. */
    REJECTED: "rejected",
    /** Our setup is wrong (keys, permissions, address whitelist); nothing was sent. */
    CONFIGURATION: "configuration",
    NOT_FOUND: "not_found",
    /** Outcome unknown — verify before deciding. */
    UNAVAILABLE: "unavailable",
    INVALID_RESPONSE: "invalid_response",
} as const;

export const CRYPTO_PURCHASE_SYNC_OUTCOME = {
    COMPLETED: "completed",
    REFUNDED: "refunded",
    PENDING: "pending",
    UNCHANGED: "unchanged",
    NEEDS_REVIEW: "needs_review",
} as const;

export const CRYPTO_STOCK_KIND = {
    TOPUP: "topup",
    SEND: "send",
    ADJUSTMENT: "adjustment",
} as const;

export type CryptoPurchaseStatus = (typeof CRYPTO_PURCHASE_STATUS)[keyof typeof CRYPTO_PURCHASE_STATUS];
export type ProviderSendStatus = (typeof PROVIDER_SEND_STATUS)[keyof typeof PROVIDER_SEND_STATUS];
export type CryptoSendErrorCode = (typeof CRYPTO_SEND_ERROR_CODE)[keyof typeof CRYPTO_SEND_ERROR_CODE];
export type CryptoPurchaseSyncOutcome = (typeof CRYPTO_PURCHASE_SYNC_OUTCOME)[keyof typeof CRYPTO_PURCHASE_SYNC_OUTCOME];

export default CRYPTO_PURCHASES;
