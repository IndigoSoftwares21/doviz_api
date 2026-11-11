import encodeStatementCursor from "@/utils/wallet/encodeStatementCursor";
import selectStatementEntries from "./queries/selectStatementEntries";
import toStatementItem from "./utils/toStatementItem";
import { StatementFilters } from "@/types/statementFilters";

/**
 * The user's naira statement, newest first — built from the ledger, so it
 * always reconciles with the balance (each line carries balanceAfter).
 * Pending deposits are not here: no money has moved yet (see /wallet/incoming).
 */
const fetchWalletTransactions = async ({
    userId,
    afterEntryId,
    size,
    filters,
}: {
    userId: string;
    afterEntryId: string | null;
    size: number;
    filters: StatementFilters;
}) => {
    const rows = await selectStatementEntries({ userId, afterEntryId, limit: size + 1, filters });
    const pageRows = rows.slice(0, size);
    const last = pageRows[pageRows.length - 1];

    const data = {
        items: pageRows.map((row) => toStatementItem({ row })),
        nextCursor: rows.length > size && last ? encodeStatementCursor({ entryId: last.id }) : null,
    };

    return { data };
};

export default fetchWalletTransactions;
