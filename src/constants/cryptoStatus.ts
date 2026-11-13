/** Status vocabularies for the crypto feature — match the DB CHECK constraints. */
export const DEPOSIT_STATUS = {
    PENDING: "pending",
    FLAGGED: "flagged",
    COMPLETED: "completed",
    DELETED: "deleted",
} as const;

export const WALLET_STATUS = {
    PENDING: "pending",
    ACTIVE: "active",
    RETIRED: "retired",
    FAILED: "failed",
} as const;

export const BANK_ACCOUNT_STATUS = {
    ACTIVE: "active",
    REMOVED: "removed",
} as const;

export const WEBHOOK_EVENT_STATUS = {
    RECEIVED: "received",
    PROCESSED: "processed",
    IGNORED: "ignored",
    FAILED: "failed",
} as const;

/** Why we flagged a deposit ourselves (stored in sub_status). */
export const DEPOSIT_FLAG_REASON = {
    /** The provider settled it in another currency (e.g. USD): no naira figure to credit — ops reviews it. */
    NOT_SETTLED_IN_NGN: "not_settled_in_ngn",
} as const;

/** What syncing one provider deposit did. */
export const SYNC_OUTCOME = {
    CREDITED: "credited",
    UPDATED: "updated",
    UNCHANGED: "unchanged",
    IGNORED: "ignored",
} as const;

/** What a provider webhook is about. */
export const WEBHOOK_RESOURCE_TYPE = {
    DEPOSIT: "deposit",
    PAYOUT: "payout",
    BILL_PAYMENT: "bill_payment",
    NAIRA_DEPOSIT: "naira_deposit",
    /** Money paid into a user's personal account number. resourceId = the provider's transaction reference. */
    ACCOUNT_DEPOSIT: "account_deposit",
    OTHER: "other",
} as const;

export const PROVIDER_ERROR_CODE = {
    LABEL_EXISTS: "label_exists",
    NOT_FOUND: "not_found",
    HTTP_ERROR: "http_error",
    NETWORK_ERROR: "network_error",
    INVALID_RESPONSE: "invalid_response",
} as const;

export type DepositStatusValue = (typeof DEPOSIT_STATUS)[keyof typeof DEPOSIT_STATUS];
export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUS)[keyof typeof WEBHOOK_EVENT_STATUS];
export type SyncOutcome = (typeof SYNC_OUTCOME)[keyof typeof SYNC_OUTCOME];
export type WebhookResourceType = (typeof WEBHOOK_RESOURCE_TYPE)[keyof typeof WEBHOOK_RESOURCE_TYPE];
export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODE)[keyof typeof PROVIDER_ERROR_CODE];
