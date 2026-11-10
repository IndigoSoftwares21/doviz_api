/** Bill payments. Provider names live only in config. Values match the DB CHECK constraints. */
const BILLS = {
    /** Provider for NEW payments and catalog listings (in-flight payments keep theirs). */
    DEFAULT_PROVIDER: "flutterwave",
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

export type BillerLinkStatus = (typeof BILLER_LINK_STATUS)[keyof typeof BILLER_LINK_STATUS];
export type BillProviderErrorCode = (typeof BILL_PROVIDER_ERROR_CODE)[keyof typeof BILL_PROVIDER_ERROR_CODE];
export type BillCategory = (typeof BILL_CATEGORY)[keyof typeof BILL_CATEGORY];
export type BillAmountType = (typeof BILL_AMOUNT_TYPE)[keyof typeof BILL_AMOUNT_TYPE];
export type BillPaymentStatus = (typeof BILL_PAYMENT_STATUS)[keyof typeof BILL_PAYMENT_STATUS];
export type ProviderBillStatus = (typeof PROVIDER_BILL_STATUS)[keyof typeof PROVIDER_BILL_STATUS];

export default BILLS;
