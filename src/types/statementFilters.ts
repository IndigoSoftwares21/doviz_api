import { EntryDirection, StatementTypeFilter } from "@/constants/ledger";

/** Optional statement filters; null means "don't filter on this". */
export interface StatementFilters {
    direction: EntryDirection | null;
    type: StatementTypeFilter | null;
    from: Date | null;
    to: Date | null;
}
