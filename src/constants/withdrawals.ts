/** Withdrawals to the user's own bank. Values match the DB CHECK constraints. */
const WITHDRAWALS = {
    CURRENCY: "NGN",
    MIN_AMOUNT: "100.00",
    MAX_AMOUNT: "5000000.00",
    /** POST /wallet/withdrawals waits this long for the provider, then answers `pending`. */
    SUBMIT_WAIT_MS: 8 * 1000,
    /** When a new withdrawal is re-checked with its provider (ms after it's made). */
    FOLLOW_UP_CHECKS_MS: [5_000, 15_000, 30_000, 60_000],
    /** A withdrawal the provider never acknowledged and still can't find after this is refunded. */
    NOT_FOUND_REFUND_AFTER_MS: 30 * 60 * 1000,
    /** The fee reserve is the highest real fee this provider charged us in this window. */
    FEE_HISTORY_DAYS: 30,
    RECONCILE_MIN_AGE_MS: 60 * 1000,
    RECONCILE_BATCH_SIZE: 50,
    NARRATION: "Doviz withdrawal",
} as const;

/** The service names in provider_settings. */
export const PROVIDER_SERVICE = {
    PAYOUTS: "payouts",
    CRYPTO_SENDS: "crypto_sends",
} as const;

/**
 * pending    — money held; sent (or about to be sent) to the provider
 * processing — outcome unknown (timeout / unclear error); the reconciler decides
 * completed  — provider confirmed; settled with the real fee
 * failed     — provider confirmed failure (or never got it); refunded in full
 */
export const WITHDRAWAL_STATUS = {
    PENDING: "pending",
    PROCESSING: "processing",
    COMPLETED: "completed",
    FAILED: "failed",
} as const;

/** What a provider says about a payout, once mapped. */
export const PROVIDER_PAYOUT_STATUS = {
    PENDING: "pending",
    COMPLETED: "completed",
    FAILED: "failed",
} as const;

/** Same meanings as the bill and collection provider error codes. */
export const PAYOUT_PROVIDER_ERROR_CODE = {
    REJECTED: "rejected",
    CONFIGURATION: "configuration",
    NOT_FOUND: "not_found",
    UNAVAILABLE: "unavailable",
    INVALID_RESPONSE: "invalid_response",
} as const;

export const WITHDRAWAL_SYNC_OUTCOME = {
    COMPLETED: "completed",
    REFUNDED: "refunded",
    PENDING: "pending",
    UNCHANGED: "unchanged",
    NEEDS_REVIEW: "needs_review",
} as const;

export type WithdrawalStatus = (typeof WITHDRAWAL_STATUS)[keyof typeof WITHDRAWAL_STATUS];
export type ProviderPayoutStatus = (typeof PROVIDER_PAYOUT_STATUS)[keyof typeof PROVIDER_PAYOUT_STATUS];
export type PayoutProviderErrorCode = (typeof PAYOUT_PROVIDER_ERROR_CODE)[keyof typeof PAYOUT_PROVIDER_ERROR_CODE];
export type WithdrawalSyncOutcome = (typeof WITHDRAWAL_SYNC_OUTCOME)[keyof typeof WITHDRAWAL_SYNC_OUTCOME];

export default WITHDRAWALS;
