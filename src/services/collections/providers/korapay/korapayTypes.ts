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
}
