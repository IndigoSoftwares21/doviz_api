/** Korapay payout API shapes (snake_case, as sent). Only fields we read; verified against the sandbox where noted. */

export interface KorapayBank {
    name: string;
    slug?: string | null;
    code: string;
}

/** POST /misc/banks/resolve (verified in sandbox). */
export interface KorapayResolvedAccount {
    account_name: string;
    bank_code?: string;
    account_number?: string;
}

/** POST /transactions/disburse and GET /transactions/:reference. */
export interface KorapayPayoutRecord {
    reference?: string | null;
    status?: string | null;
    amount?: number | string | null;
    fee?: number | string | null;
    currency?: string | null;
    message?: string | null;
    trace_id?: string | null;
}

/** GET /balances (verified in sandbox): per currency. */
export type KorapayBalances = Record<string, { available_balance?: number | string | null; pending_balance?: number | string | null }>;
