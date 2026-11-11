/** Ledger vocabulary — the database CHECK constraints use exactly these values. */
export const LEDGER_ACCOUNT_KIND = {
    USER_AVAILABLE: "user_available",
    PROVIDER_CLEARING: "provider_clearing",
    PAYOUTS_IN_TRANSIT: "payouts_in_transit",
    MARKUP_REVENUE: "markup_revenue",
    BILLS_IN_TRANSIT: "bills_in_transit",
    BILL_REVENUE: "bill_revenue",
    PROVIDER_FEES: "provider_fees",
    CRYPTO_SENDS_IN_TRANSIT: "crypto_sends_in_transit",
    CRYPTO_SALES: "crypto_sales",
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
    CRYPTO_PURCHASE_HOLD: "crypto_purchase_hold",
    CRYPTO_PURCHASE_SETTLE: "crypto_purchase_settle",
    CRYPTO_PURCHASE_REVERSAL: "crypto_purchase_reversal",
} as const;

export type LedgerAccountKind = (typeof LEDGER_ACCOUNT_KIND)[keyof typeof LEDGER_ACCOUNT_KIND];
export type LedgerTransactionType = (typeof LEDGER_TRANSACTION_TYPE)[keyof typeof LEDGER_TRANSACTION_TYPE];

/** Whether a statement line added to (credit) or took from (debit) the balance. */
export const ENTRY_DIRECTION = {
    CREDIT: "credit",
    DEBIT: "debit",
} as const;

export type EntryDirection = (typeof ENTRY_DIRECTION)[keyof typeof ENTRY_DIRECTION];

/**
 * Statement filter "type" → the ledger transaction types it covers. Refunds
 * and fee adjustments sit with the thing they belong to, so filtering by
 * bills also shows a refunded bill.
 */
export const STATEMENT_TYPE_FILTER = {
    CRYPTO: "crypto",
    BANK_TRANSFER: "bank_transfer",
    WITHDRAWAL: "withdrawal",
    BILL: "bill",
} as const;

export type StatementTypeFilter = (typeof STATEMENT_TYPE_FILTER)[keyof typeof STATEMENT_TYPE_FILTER];

export const STATEMENT_TYPE_LEDGER_TYPES: Record<StatementTypeFilter, LedgerTransactionType[]> = {
    [STATEMENT_TYPE_FILTER.CRYPTO]: [LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT],
    [STATEMENT_TYPE_FILTER.BANK_TRANSFER]: [LEDGER_TRANSACTION_TYPE.NAIRA_DEPOSIT],
    [STATEMENT_TYPE_FILTER.WITHDRAWAL]: [
        LEDGER_TRANSACTION_TYPE.WITHDRAWAL_HOLD,
        LEDGER_TRANSACTION_TYPE.WITHDRAWAL_SETTLE,
        LEDGER_TRANSACTION_TYPE.WITHDRAWAL_REVERSAL,
    ],
    [STATEMENT_TYPE_FILTER.BILL]: [
        LEDGER_TRANSACTION_TYPE.BILL_HOLD,
        LEDGER_TRANSACTION_TYPE.BILL_SETTLE,
        LEDGER_TRANSACTION_TYPE.BILL_REVERSAL,
    ],
};
