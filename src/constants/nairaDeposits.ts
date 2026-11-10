/** Naira deposits by bank transfer. Provider names live only in config. Values match the DB CHECK constraints. */
const NAIRA_DEPOSITS = {
    CURRENCY: "NGN",
    /** Providers for NEW deposits, in order of preference (NAIRA_COLLECTION_PROVIDERS overrides). */
    DEFAULT_PROVIDERS: ["korapay"],
    /** Per deposit, in naira — what the user asks to receive. */
    MIN_AMOUNT: "100.00",
    MAX_AMOUNT: "5000000.00",
    /**
     * An expired account can still be paid (a slow bank, a transfer started
     * just before expiry); providers settle those. The reconciler keeps
     * checking expired deposits this long after expiry.
     */
    LATE_PAYMENT_WINDOW_MS: 24 * 60 * 60 * 1000,
    /** The reconciler leaves very new deposits alone; webhooks handle the normal case. */
    RECONCILE_MIN_AGE_MS: 60 * 1000,
    RECONCILE_BATCH_SIZE: 50,
    HISTORY_DEFAULT_LIMIT: 20,
    HISTORY_MAX_LIMIT: 50,
} as const;

/** Who pays the provider's transfer fee. user = added to what they send (default); doviz = taken from our settlement. */
export const FEE_BEARER = {
    USER: "user",
    DOVIZ: "doviz",
} as const;

/**
 * pending   — account issued (or being issued); waiting for the transfer
 * expired   — the account lapsed unpaid; a late payment can still complete it
 * completed — provider confirmed; user credited
 * failed    — no account could be issued, or the provider reported the charge failed
 */
export const NAIRA_DEPOSIT_STATUS = {
    PENDING: "pending",
    EXPIRED: "expired",
    COMPLETED: "completed",
    FAILED: "failed",
} as const;

/** What a provider says about a transfer, once mapped. */
export const PROVIDER_TRANSFER_STATUS = {
    PENDING: "pending",
    COMPLETED: "completed",
    EXPIRED: "expired",
    FAILED: "failed",
} as const;

/**
 * Why a collection provider call failed.
 * rejected         — the provider refused the request; nothing was created
 * configuration    — refused because of OUR setup (keys, account); alert, don't blame the user
 * not_found        — no such record
 * unavailable      — network / timeout / 5xx / rate limit: outcome unknown
 * invalid_response — an answer we can't read: outcome unknown
 */
export const COLLECTION_PROVIDER_ERROR_CODE = {
    REJECTED: "rejected",
    CONFIGURATION: "configuration",
    NOT_FOUND: "not_found",
    UNAVAILABLE: "unavailable",
    INVALID_RESPONSE: "invalid_response",
} as const;

/** What one sync of a deposit did. */
export const NAIRA_DEPOSIT_SYNC_OUTCOME = {
    CREDITED: "credited",
    EXPIRED: "expired",
    FAILED: "failed",
    PENDING: "pending",
    UNCHANGED: "unchanged",
} as const;

export type FeeBearer = (typeof FEE_BEARER)[keyof typeof FEE_BEARER];
export type NairaDepositStatus = (typeof NAIRA_DEPOSIT_STATUS)[keyof typeof NAIRA_DEPOSIT_STATUS];
export type ProviderTransferStatus = (typeof PROVIDER_TRANSFER_STATUS)[keyof typeof PROVIDER_TRANSFER_STATUS];
export type CollectionProviderErrorCode = (typeof COLLECTION_PROVIDER_ERROR_CODE)[keyof typeof COLLECTION_PROVIDER_ERROR_CODE];
export type NairaDepositSyncOutcome = (typeof NAIRA_DEPOSIT_SYNC_OUTCOME)[keyof typeof NAIRA_DEPOSIT_SYNC_OUTCOME];

export default NAIRA_DEPOSITS;
