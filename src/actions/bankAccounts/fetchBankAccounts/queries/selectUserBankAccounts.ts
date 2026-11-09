import { db } from "@/database";
import { BANK_ACCOUNT_STATUS } from "@/constants/cryptoStatus";

const selectUserBankAccounts = async ({ userId }: { userId: string }) => {
    const bankAccountRows = await db
        .selectFrom("user_bank_accounts")
        .innerJoin("payout_banks", "payout_banks.id", "user_bank_accounts.payoutBankId")
        .select([
            "user_bank_accounts.id",
            "user_bank_accounts.payoutBankId as bankId",
            "payout_banks.name as bankName",
            "user_bank_accounts.accountNumber",
            "user_bank_accounts.accountName",
            "user_bank_accounts.isPrimary",
            "user_bank_accounts.verifiedAt",
        ])
        .where("user_bank_accounts.userId", "=", userId)
        .where("user_bank_accounts.status", "=", BANK_ACCOUNT_STATUS.ACTIVE)
        .orderBy("user_bank_accounts.isPrimary", "desc")
        .orderBy("user_bank_accounts.createdAt", "desc")
        .execute();

    return bankAccountRows;
};

export default selectUserBankAccounts;
