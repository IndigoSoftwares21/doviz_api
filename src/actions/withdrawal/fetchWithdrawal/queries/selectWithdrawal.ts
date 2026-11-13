import { db } from "@/database";

/**
 * One of the user's own withdrawals (never anyone else's), to wherever it
 * went: their saved account, or the recipient recorded on it.
 */
const selectWithdrawal = async ({ id, userId }: { id: string; userId: string }) => {
    const withdrawalRow = await db
        .selectFrom("bank_withdrawals")
        .leftJoin("user_bank_accounts", "user_bank_accounts.id", "bank_withdrawals.bankAccountId")
        .leftJoin("payout_banks as own_bank", "own_bank.id", "user_bank_accounts.payoutBankId")
        .leftJoin("payout_banks as recipient_bank", "recipient_bank.id", "bank_withdrawals.recipientPayoutBankId")
        .select((eb) => [
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
            "bank_withdrawals.narration",
            "bank_withdrawals.bankAccountId",
            eb.fn.coalesce("user_bank_accounts.accountNumber", "bank_withdrawals.recipientAccountNumber").as("accountNumber"),
            eb.fn.coalesce("user_bank_accounts.accountName", "bank_withdrawals.recipientAccountName").as("accountName"),
            eb.fn.coalesce("own_bank.name", "recipient_bank.name").as("bankName"),
        ])
        .where("bank_withdrawals.id", "=", id)
        .where("bank_withdrawals.userId", "=", userId)
        .executeTakeFirst();

    return withdrawalRow;
};

export default selectWithdrawal;
