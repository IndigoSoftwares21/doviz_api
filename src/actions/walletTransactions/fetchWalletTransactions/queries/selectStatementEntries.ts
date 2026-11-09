import { sql } from "kysely";
import { db } from "@/database";
import { LEDGER_ACCOUNT_KIND } from "@/constants/ledger";

/**
 * The user's naira statement: their ledger entries (each with the balance
 * after it), joined to what caused them. Keyset-paged on (created_at, id)
 * compared INSIDE Postgres, so microsecond timestamps never lose precision.
 */
const selectStatementEntries = async ({ userId, afterEntryId, limit }: { userId: string; afterEntryId: string | null; limit: number }) => {
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
