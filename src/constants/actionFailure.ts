/**
 * Why an action returned no data. Actions return `{ data: null, failure }`
 * and controllers map each failure to a response — always via these names,
 * never bare strings.
 */
const ACTION_FAILURE = {
    INVALID_SESSION: "invalid_session",
    PIN: "pin",
    BIOMETRIC: "biometric",
    BIOMETRICS_OFF: "biometrics_off",
    RESOLVE_FAILED: "resolve_failed",
    NAME_MISMATCH: "name_mismatch",
    MARKUP_MISSING: "markup_missing",
    PROVIDER_UNAVAILABLE: "provider_unavailable",
    CUSTOMER_NOT_FOUND: "customer_not_found",
    INSUFFICIENT_BALANCE: "insufficient_balance",
    AMOUNT_OUT_OF_RANGE: "amount_out_of_range",
    BANK_UNSUPPORTED: "bank_unsupported",
    QUOTE_CHANGED: "quote_changed",
    RATE_UNAVAILABLE: "rate_unavailable",
    ASSET_UNAVAILABLE: "asset_unavailable",
    INVALID_ADDRESS: "invalid_address",
    STOCK_UNAVAILABLE: "stock_unavailable",
    RECIPIENT_UNAVAILABLE: "recipient_unavailable",
    TRANSFER_LIMIT: "transfer_limit",
    ACCOUNT_INACTIVE: "account_inactive",
    KYC_ALREADY_VERIFIED: "kyc_already_verified",
    KYC_IN_REVIEW: "kyc_in_review",
    KYC_IDENTIFIER_IN_USE: "kyc_identifier_in_use",
    KYC_REQUIRED: "kyc_required",
    VIRTUAL_ACCOUNT_REFUSED: "virtual_account_refused",
    ACCOUNT_NUMBERS_OFF: "account_numbers_off",
} as const;

export type ActionFailure = (typeof ACTION_FAILURE)[keyof typeof ACTION_FAILURE];

export default ACTION_FAILURE;
