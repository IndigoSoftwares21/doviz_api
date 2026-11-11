import { EntryDirection, StatementTypeFilter } from "@/constants/ledger";

/** What a `q` search can match on a statement line (see buildStatementSearch). */
export interface StatementSearch {
    /** LIKE pattern for names (biller), already escaped. */
    contains: string;
    /** LIKE pattern for prefixes (coin symbol), already escaped. */
    prefix: string;
    /** Exact amount, e.g. "1000.00". */
    amount: string | null;
    /** LIKE pattern for the start of the entry id. */
    referencePrefix: string | null;
    /** LIKE pattern for a phone / meter / smartcard number fragment. */
    customerContains: string | null;
    /** Kinds of transaction the words mean ("refund" → reversals). */
    ledgerTypes: string[];
    /** Bill categories the words mean ("light" → electricity). */
    billCategories: string[];
}

/** Optional statement filters; null means "don't filter on this". */
export interface StatementFilters {
    direction: EntryDirection | null;
    type: StatementTypeFilter | null;
    from: Date | null;
    to: Date | null;
    search: StatementSearch | null;
}
