import { LEDGER_TRANSACTION_TYPE, LedgerTransactionType } from "@/constants/ledger";
import { BILL_CATEGORY } from "@/constants/bills";

/** Limits for the statement's `q` search. */
export const STATEMENT_SEARCH = {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50,
    /** A reference prefix must be at least this long (hex digits / dashes). */
    MIN_REFERENCE_LENGTH: 4,
    /** A customer-number fragment (phone / meter) must be at least this many digits. */
    MIN_CUSTOMER_DIGITS: 4,
    /** Words shorter than this don't match keywords ("da" shouldn't mean data). */
    MIN_KEYWORD_LENGTH: 3,
} as const;

/**
 * Statement descriptions are generated, not stored, so words people search
 * with map to what they mean: a ledger type, or a bill category. A word
 * matches when a keyword starts with it ("elec" → electricity).
 */
export const STATEMENT_SEARCH_KEYWORDS: {
    words: string[];
    ledgerTypes?: LedgerTransactionType[];
    billCategories?: string[];
}[] = [
    { words: ["airtime", "recharge", "credit"], billCategories: [BILL_CATEGORY.AIRTIME] },
    { words: ["data", "bundle", "internet"], billCategories: [BILL_CATEGORY.DATA, BILL_CATEGORY.INTERNET] },
    { words: ["electricity", "electric", "light", "power", "meter", "nepa", "prepaid", "postpaid"], billCategories: [BILL_CATEGORY.ELECTRICITY] },
    { words: ["cable", "television", "tv", "smartcard", "decoder", "subscription"], billCategories: [BILL_CATEGORY.CABLE_TV] },
    {
        words: ["bill", "bills", "payment"],
        ledgerTypes: [LEDGER_TRANSACTION_TYPE.BILL_HOLD, LEDGER_TRANSACTION_TYPE.BILL_SETTLE, LEDGER_TRANSACTION_TYPE.BILL_REVERSAL],
    },
    {
        words: ["withdrawal", "withdraw", "payout", "bank", "send", "sent"],
        ledgerTypes: [LEDGER_TRANSACTION_TYPE.WITHDRAWAL_HOLD, LEDGER_TRANSACTION_TYPE.WITHDRAWAL_SETTLE, LEDGER_TRANSACTION_TYPE.WITHDRAWAL_REVERSAL],
    },
    { words: ["deposit", "transfer", "topup", "fund", "add", "received"], ledgerTypes: [LEDGER_TRANSACTION_TYPE.NAIRA_DEPOSIT, LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT] },
    { words: ["crypto", "convert", "conversion", "swap", "coin"], ledgerTypes: [LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT] },
    {
        words: ["buy", "purchase", "bought"],
        ledgerTypes: [LEDGER_TRANSACTION_TYPE.CRYPTO_PURCHASE_HOLD, LEDGER_TRANSACTION_TYPE.CRYPTO_PURCHASE_SETTLE, LEDGER_TRANSACTION_TYPE.CRYPTO_PURCHASE_REVERSAL],
    },
    {
        words: ["refund", "refunded", "reversal", "reversed", "returned"],
        ledgerTypes: [
            LEDGER_TRANSACTION_TYPE.WITHDRAWAL_REVERSAL,
            LEDGER_TRANSACTION_TYPE.BILL_REVERSAL,
            LEDGER_TRANSACTION_TYPE.CRYPTO_PURCHASE_REVERSAL,
        ],
    },
];
