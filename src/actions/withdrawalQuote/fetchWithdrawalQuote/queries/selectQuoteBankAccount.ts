import { db } from "@/database";

/** One of the user's own active, name-matched bank accounts (the schema has checked it exists). */
const selectQuoteBankAccount = async ({ bankAccountId, userId }: { bankAccountId: string; userId: string }) => {
    const accountRow = await db
        .selectFrom("user_bank_accounts")
        .innerJoin("payout_banks", "payout_banks.id", "user_bank_accounts.payoutBankId")
        .select([
            "user_bank_accounts.id",
            "user_bank_accounts.payoutBankId",
            "user_bank_accounts.accountNumber",
            "user_bank_accounts.accountName",
            "payout_banks.name as bankName",
        ])
        .where("user_bank_accounts.id", "=", bankAccountId)
        .where("user_bank_accounts.userId", "=", userId)
        .where("user_bank_accounts.status", "=", "active")
        .executeTakeFirstOrThrow();

    return accountRow;
};

export default selectQuoteBankAccount;
