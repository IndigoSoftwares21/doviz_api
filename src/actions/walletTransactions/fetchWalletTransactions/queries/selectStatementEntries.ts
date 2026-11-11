import { sql } from "kysely";
import { db } from "@/database";
import { ENTRY_DIRECTION, LEDGER_ACCOUNT_KIND, STATEMENT_TYPE_LEDGER_TYPES } from "@/constants/ledger";
import { StatementFilters } from "@/types/statementFilters";

/**
 * The user's naira statement: their ledger entries (each with the balance
 * after it), joined to what caused them. Keyset-paged on (created_at, id)
 * compared INSIDE Postgres, so microsecond timestamps never lose precision.
 *
 * Filters only add WHERE clauses, so paging works the same within them.
 * Direction comes from the entry's own sign (the rule toStatementItem uses),
 * so "money in" always matches the "+" rows. `from` inclusive, `to` exclusive.
 */
const selectStatementEntries = async ({
    userId,
    afterEntryId,
    limit,
    filters,
}: {
    userId: string;
    afterEntryId: string | null;
    limit: number;
    filters: StatementFilters;
}) => {
    let query = db
        .selectFrom("ledger_entries")
        .innerJoin("ledger_accounts", "ledger_accounts.id", "ledger_entries.accountId")
        .innerJoin("ledger_transactions", "ledger_transactions.id", "ledger_entries.transactionId")
        .leftJoin("crypto_deposits", "crypto_deposits.ledgerTransactionId", "ledger_transactions.id")
        .leftJoin("crypto_assets", "crypto_assets.id", "crypto_deposits.assetId")
        .select([
            "ledger_entries.id",
            "ledger_entries.amount",
            "ledger_entries.balanceAfter",
            "ledger_entries.createdAt",
            "ledger_transactions.type",
            "crypto_deposits.id as depositId",
            "crypto_assets.symbol",
            "crypto_assets.network",
            "crypto_deposits.cryptoAmount",
            "crypto_deposits.grossNgn",
            "crypto_deposits.markupNgn",
            "crypto_deposits.markupPercent",
        ])
        .where("ledger_accounts.kind", "=", LEDGER_ACCOUNT_KIND.USER_AVAILABLE)
        .where("ledger_accounts.userId", "=", userId);

    if (filters.direction === ENTRY_DIRECTION.CREDIT) query = query.where("ledger_entries.amount", ">", "0");
    if (filters.direction === ENTRY_DIRECTION.DEBIT) query = query.where("ledger_entries.amount", "<", "0");
    if (filters.type) query = query.where("ledger_transactions.type", "in", STATEMENT_TYPE_LEDGER_TYPES[filters.type]);
    if (filters.from) query = query.where("ledger_entries.createdAt", ">=", filters.from);
    if (filters.to) query = query.where("ledger_entries.createdAt", "<", filters.to);

    if (afterEntryId) {
        query = query.where(
            sql<boolean>`(ledger_entries.created_at, ledger_entries.id) < (select created_at, id from ledger_entries where id = ${afterEntryId})`,
        );
    }

    const entryRows = await query
        .orderBy("ledger_entries.createdAt", "desc")
        .orderBy("ledger_entries.id", "desc")
        .limit(limit)
        .execute();

    return entryRows;
};

export default selectStatementEntries;
