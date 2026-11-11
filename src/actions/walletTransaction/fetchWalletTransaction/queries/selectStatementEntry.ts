import { db } from "@/database";
import { LEDGER_ACCOUNT_KIND } from "@/constants/ledger";

/** One of the user's statement lines (existence/ownership checked in the schema). */
const selectStatementEntry = async ({ userId, entryId }: { userId: string; entryId: string }) => {
    const entryRow = await db
        .selectFrom("ledger_entries")
        .innerJoin("ledger_accounts", "ledger_accounts.id", "ledger_entries.accountId")
        .innerJoin("ledger_transactions", "ledger_transactions.id", "ledger_entries.transactionId")
        .leftJoin("crypto_deposits", "crypto_deposits.ledgerTransactionId", "ledger_transactions.id")
        .leftJoin("crypto_assets", "crypto_assets.id", "crypto_deposits.assetId")
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
            "bill_payments.id as billPaymentId",
            "billers.categoryCode as billCategory",
            "billers.name as billerName",
            "bill_products.name as billProductName",
            "bill_payments.customerId as billCustomerId",
            "crypto_deposits.rateNgnPerUsd",
            "crypto_deposits.txHash",
            "crypto_deposits.confirmations",
            "crypto_deposits.detectedAt",
            "crypto_deposits.completedAt",
        ])
        .where("ledger_entries.id", "=", entryId)
        .where("ledger_accounts.kind", "=", LEDGER_ACCOUNT_KIND.USER_AVAILABLE)
        .where("ledger_accounts.userId", "=", userId)
        .executeTakeFirstOrThrow();

    return entryRow;
};

export default selectStatementEntry;
