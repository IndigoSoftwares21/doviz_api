/** Ledger vocabulary — the database CHECK constraints use exactly these values. */
export const LEDGER_ACCOUNT_KIND = {
    USER_AVAILABLE: "user_available",
    PROVIDER_CLEARING: "provider_clearing",
    PAYOUTS_IN_TRANSIT: "payouts_in_transit",
    MARKUP_REVENUE: "markup_revenue",
    BILLS_IN_TRANSIT: "bills_in_transit",
    BILL_REVENUE: "bill_revenue",
    PROVIDER_FEES: "provider_fees",
} as const;

export const LEDGER_TRANSACTION_TYPE = {
    CRYPTO_DEPOSIT: "crypto_deposit",
    WITHDRAWAL_HOLD: "withdrawal_hold",
    WITHDRAWAL_SETTLE: "withdrawal_settle",
    WITHDRAWAL_REVERSAL: "withdrawal_reversal",
    BILL_HOLD: "bill_hold",
    BILL_SETTLE: "bill_settle",
    BILL_REVERSAL: "bill_reversal",
    NAIRA_DEPOSIT: "naira_deposit",
} as const;

export type LedgerAccountKind = (typeof LEDGER_ACCOUNT_KIND)[keyof typeof LEDGER_ACCOUNT_KIND];
export type LedgerTransactionType = (typeof LEDGER_TRANSACTION_TYPE)[keyof typeof LEDGER_TRANSACTION_TYPE];

/** Whether a statement line added to (credit) or took from (debit) the balance. */
export const ENTRY_DIRECTION = {
    CREDIT: "credit",
    DEBIT: "debit",
} as const;

export type EntryDirection = (typeof ENTRY_DIRECTION)[keyof typeof ENTRY_DIRECTION];
