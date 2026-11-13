import { Expression, SqlBool, sql } from "kysely";
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
 * `search` matches any of: biller, coin, amount, reference, customer number,
 * or the kind of transaction its words mean (see buildStatementSearch).
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
        .leftJoin("internal_transfers", "internal_transfers.ledgerTransactionId", "ledger_transactions.id")
        .leftJoin("users as transfer_sender", "transfer_sender.id", "internal_transfers.senderId")
        .leftJoin("users as transfer_recipient", "transfer_recipient.id", "internal_transfers.recipientId")
        // The bill this line belongs to: its hold, or its final settle/refund
        // (both columns are unique, so at most one payment matches).
        .leftJoin("bill_payments", (join) =>
            join.on((eb) =>
                eb.or([
                    eb("bill_payments.holdLedgerTransactionId", "=", eb.ref("ledger_transactions.id")),
                    eb("bill_payments.finalLedgerTransactionId", "=", eb.ref("ledger_transactions.id")),
                ]),
            ),
        )
        .leftJoin("billers", "billers.id", "bill_payments.billerId")
        .leftJoin("bill_products", "bill_products.id", "bill_payments.productId")
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
            "internal_transfers.id as transferId",
            "internal_transfers.senderTag as transferSenderTag",
            "internal_transfers.recipientTag as transferRecipientTag",
            "internal_transfers.note as transferNote",
            "transfer_sender.firstName as transferSenderFirstName",
            "transfer_sender.lastName as transferSenderLastName",
            "transfer_recipient.firstName as transferRecipientFirstName",
            "transfer_recipient.lastName as transferRecipientLastName",
            "bill_payments.id as billPaymentId",
            "billers.categoryCode as billCategory",
            "billers.name as billerName",
            "bill_products.name as billProductName",
            "bill_payments.customerId as billCustomerId",
            "bill_payments.token as billToken",
        ])
        .where("ledger_accounts.kind", "=", LEDGER_ACCOUNT_KIND.USER_AVAILABLE)
        .where("ledger_accounts.userId", "=", userId);

    if (filters.direction === ENTRY_DIRECTION.CREDIT) query = query.where("ledger_entries.amount", ">", "0");
    if (filters.direction === ENTRY_DIRECTION.DEBIT) query = query.where("ledger_entries.amount", "<", "0");
    if (filters.type) query = query.where("ledger_transactions.type", "in", STATEMENT_TYPE_LEDGER_TYPES[filters.type]);
    if (filters.from) query = query.where("ledger_entries.createdAt", ">=", filters.from);
    if (filters.to) query = query.where("ledger_entries.createdAt", "<", filters.to);

    const { search } = filters;
    if (search) {
        query = query.where((eb) => {
            const matches: Expression<SqlBool>[] = [
                eb("billers.name", "ilike", search.contains),
                eb("crypto_assets.symbol", "ilike", search.prefix),
            ];
            if (search.amount) matches.push(sql<SqlBool>`abs(${eb.ref("ledger_entries.amount")}) = ${search.amount}::numeric`);
            if (search.referencePrefix) matches.push(sql<SqlBool>`${eb.ref("ledger_entries.id")}::text ilike ${search.referencePrefix}`);
            if (search.customerContains) matches.push(eb("bill_payments.customerId", "like", search.customerContains));
            if (search.ledgerTypes.length) matches.push(eb("ledger_transactions.type", "in", search.ledgerTypes));
            if (search.billCategories.length) matches.push(eb("billers.categoryCode", "in", search.billCategories));
            return eb.or(matches);
        });
    }

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
