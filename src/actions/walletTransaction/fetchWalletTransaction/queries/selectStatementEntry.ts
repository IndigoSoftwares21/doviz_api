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
        .leftJoin("naira_deposits", "naira_deposits.ledgerTransactionId", "ledger_transactions.id")
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
            "crypto_deposits.rateNgnPerUsd",
            "crypto_deposits.txHash",
            "crypto_deposits.confirmations",
            "crypto_deposits.detectedAt",
            "crypto_deposits.completedAt",
            "naira_deposits.id as nairaDepositId",
            "naira_deposits.senderName",
            "naira_deposits.senderBankName",
            "naira_deposits.senderAccountNumber",
        ])
        .where("ledger_entries.id", "=", entryId)
        .where("ledger_accounts.kind", "=", LEDGER_ACCOUNT_KIND.USER_AVAILABLE)
        .where("ledger_accounts.userId", "=", userId)
        .executeTakeFirstOrThrow();

    return entryRow;
};

export default selectStatementEntry;
