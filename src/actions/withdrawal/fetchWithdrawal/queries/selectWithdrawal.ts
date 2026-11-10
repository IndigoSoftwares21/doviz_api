import { db } from "@/database";

/** One of the user's own withdrawals (never anyone else's). */
const selectWithdrawal = async ({ id, userId }: { id: string; userId: string }) => {
    const withdrawalRow = await db
        .selectFrom("bank_withdrawals")
        .innerJoin("user_bank_accounts", "user_bank_accounts.id", "bank_withdrawals.bankAccountId")
        .innerJoin("payout_banks", "payout_banks.id", "user_bank_accounts.payoutBankId")
        .select([
            "bank_withdrawals.id",
            "bank_withdrawals.status",
            "bank_withdrawals.currency",
            "bank_withdrawals.amount",
            "bank_withdrawals.fee",
            "bank_withdrawals.feeReserve",
            "bank_withdrawals.totalHeld",
            "bank_withdrawals.failureReason",
            "bank_withdrawals.requestedAt",
            "bank_withdrawals.finalizedAt",
            "user_bank_accounts.id as bankAccountId",
            "user_bank_accounts.accountNumber",
            "user_bank_accounts.accountName",
            "payout_banks.name as bankName",
        ])
        .where("bank_withdrawals.id", "=", id)
        .where("bank_withdrawals.userId", "=", userId)
        .executeTakeFirst();

    return withdrawalRow;
};

export default selectWithdrawal;
