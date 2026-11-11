/** Korapay response shapes — only the fields we read. Amounts arrive as numbers or strings. */

type KorapayAmount = number | string | null | undefined;

export interface KorapayBankTransferCharge {
    reference?: string;
    payment_reference?: string;
    amount?: KorapayAmount;
    amount_expected?: KorapayAmount;
    fee?: KorapayAmount;
    vat?: KorapayAmount;
    currency?: string;
    status?: string;
    bank_account?: {
        account_name?: string;
        account_number?: string;
        bank_name?: string;
        expiry_date_in_utc?: string;
    };
}

/** The account a bank transfer came FROM (Korapay sends it on paid charges). */
export interface KorapayPayerBankAccount {
    account_name?: string | null;
    account_number?: string | null;
    bank_name?: string | null;
    bank_code?: string | null;
}

export interface KorapayCharge {
    reference?: string;
    payment_reference?: string;
    status?: string;
    amount?: KorapayAmount;
    amount_paid?: KorapayAmount;
    fee?: KorapayAmount;
    vat?: KorapayAmount;
    currency?: string;
    transaction_date?: string;
    payer_bank_account?: KorapayPayerBankAccount | null;
    bank_transfer?: { payer_bank_account?: KorapayPayerBankAccount | null } | null;
}
