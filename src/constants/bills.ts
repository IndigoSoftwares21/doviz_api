/** Bill payments. Provider names live only in config. Values match the DB CHECK constraints. */
const BILLS = {
    /** Provider for NEW payments and catalog listings (in-flight payments keep theirs). */
    DEFAULT_PROVIDER: "flutterwave",
    /**
     * A payment the provider still can't find this long after we sent it is
     * refunded — but only if our request never got an answer. One the
     * provider acknowledged (we hold its reference) is never auto-refunded.
     */
    NOT_FOUND_REFUND_AFTER_MS: 30 * 60 * 1000,
    /**
     * How long POST /bills/payments waits for the provider before answering
     * `pending` and finishing in the background — keeps the response well
     * under the app's 15s timeout however slow the provider is (Flutterwave
     * has taken 15s+). The money is already held when this starts.
     */
    SUBMIT_WAIT_MS: 8 * 1000,
    /**
     * When a new payment is re-checked with its provider (ms after it's made),
     * so the app hears the result over the socket within seconds even without
     * a provider webhook. After the last, the reconciler takes over.
     */
    FOLLOW_UP_CHECKS_MS: [5_000, 15_000, 30_000, 60_000],
    /** The reconciler leaves very new payments to the request that made them. */
    RECONCILE_MIN_AGE_MS: 60 * 1000,
    RECONCILE_BATCH_SIZE: 50,
    HISTORY_DEFAULT_LIMIT: 20,
    HISTORY_MAX_LIMIT: 50,
} as const;

/** Fixed list Doviz owns — the app groups billers by these. */
export const BILL_CATEGORY = {
    AIRTIME: "airtime",
    DATA: "data",
    ELECTRICITY: "electricity",
    CABLE_TV: "cable_tv",
    INTERNET: "internet",
} as const;

/** fixed = one price (bundle, plan); range = any amount between min and max (airtime, electricity). */
export const BILL_AMOUNT_TYPE = {
    FIXED: "fixed",
    RANGE: "range",
} as const;

/**
 * pending    — money held; sent (or about to be sent) to the provider
 * processing — outcome unknown (timeout / unclear error); the reconciler decides
 * completed  — provider confirmed; hold settled
 * failed     — provider confirmed failure; hold refunded
 */
export const BILL_PAYMENT_STATUS = {
    PENDING: "pending",
    PROCESSING: "processing",
    COMPLETED: "completed",
    FAILED: "failed",
} as const;

/** What a provider says about a payment, once mapped. Never "processing" — that's our own uncertainty. */
export const PROVIDER_BILL_STATUS = {
    PENDING: "pending",
    COMPLETED: "completed",
    FAILED: "failed",
} as const;

/**
 * Nigerian mobile prefixes by the network that ISSUED them — the same for
 * every bill provider. Ported numbers keep their old prefix, so a detected
 * network is only a default the user can change. Longest prefixes are checked
 * first (07025/07026 are MTN inside other operators' 0702 range).
 */
export const MOBILE_NETWORKS = [
    {
        code: "mtn",
        name: "MTN",
        prefixes: ["07025", "07026", "0703", "0704", "0706", "0803", "0806", "0810", "0813", "0814", "0816", "0903", "0906", "0913", "0916"],
    },
    { code: "airtel", name: "Airtel", prefixes: ["0701", "0708", "0802", "0808", "0812", "0901", "0902", "0904", "0907", "0911", "0912"] },
    { code: "glo", name: "Glo", prefixes: ["0705", "0805", "0807", "0811", "0815", "0905", "0915"] },
    { code: "9mobile", name: "9mobile", prefixes: ["0809", "0817", "0818", "0908", "0909"] },
] as const;

export type MobileNetworkCode = (typeof MOBILE_NETWORKS)[number]["code"];

/**
 * How a provider biller links to ours (see biller_provider_refs).
 * suggested — the sync's guess; confirmed / ignored — a person reviewed it.
 */
export const BILLER_LINK_STATUS = {
    SUGGESTED: "suggested",
    CONFIRMED: "confirmed",
    IGNORED: "ignored",
} as const;

/**
 * Limits for `range` products when the provider gives none. Whole naira, per
 * category. A provider's own limits (catalog or customer validation) win.
 */
export const BILL_RANGE_DEFAULTS: Record<BillCategory, { min: string; max: string }> = {
    airtime: { min: "50.00", max: "50000.00" },
    data: { min: "50.00", max: "50000.00" },
    electricity: { min: "500.00", max: "500000.00" },
    cable_tv: { min: "100.00", max: "500000.00" },
    internet: { min: "100.00", max: "500000.00" },
};

/**
 * Why a bill provider call failed — the payment flow decides refunds on this.
 * rejected      — the provider refused the request (bad customer, amount...); nothing was charged
 * configuration — the provider refused because of OUR setup (credentials, IP whitelist);
 *                 nothing was charged, not the customer's fault — alert, don't blame them
 * not_found     — the provider has no such record
 * unavailable   — network / timeout / 5xx / rate limit: outcome UNKNOWN, retry later
 * invalid_response — the provider answered something we can't read: outcome UNKNOWN
 */
export const BILL_PROVIDER_ERROR_CODE = {
    REJECTED: "rejected",
    CONFIGURATION: "configuration",
    NOT_FOUND: "not_found",
    UNAVAILABLE: "unavailable",
    INVALID_RESPONSE: "invalid_response",
} as const;

/** What one sync of a bill payment did. */
export const BILL_SYNC_OUTCOME = {
    COMPLETED: "completed",
    REFUNDED: "refunded",
    PENDING: "pending",
    UNCHANGED: "unchanged",
    NEEDS_REVIEW: "needs_review",
} as const;

export type BillSyncOutcome = (typeof BILL_SYNC_OUTCOME)[keyof typeof BILL_SYNC_OUTCOME];
export type BillerLinkStatus = (typeof BILLER_LINK_STATUS)[keyof typeof BILLER_LINK_STATUS];
export type BillProviderErrorCode = (typeof BILL_PROVIDER_ERROR_CODE)[keyof typeof BILL_PROVIDER_ERROR_CODE];
export type BillCategory = (typeof BILL_CATEGORY)[keyof typeof BILL_CATEGORY];
export type BillAmountType = (typeof BILL_AMOUNT_TYPE)[keyof typeof BILL_AMOUNT_TYPE];
export type BillPaymentStatus = (typeof BILL_PAYMENT_STATUS)[keyof typeof BILL_PAYMENT_STATUS];
export type ProviderBillStatus = (typeof PROVIDER_BILL_STATUS)[keyof typeof PROVIDER_BILL_STATUS];

export default BILLS;
