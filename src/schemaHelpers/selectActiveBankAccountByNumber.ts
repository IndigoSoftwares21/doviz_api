import { db } from "@/database";
import { BANK_ACCOUNT_STATUS } from "@/constants/cryptoStatus";

const selectActiveBankAccountByNumber = async ({
    userId,
    bankId,
    accountNumber,
}: {
    userId: string;
    bankId: string;
    accountNumber: string;
}) => {
    const bankAccountRow = await db
        .selectFrom("user_bank_accounts")
        .select(["id"])
        .where("userId", "=", userId)
        .where("payoutBankId", "=", bankId)
        .where("accountNumber", "=", accountNumber)
        .where("status", "=", BANK_ACCOUNT_STATUS.ACTIVE)
        .executeTakeFirst();

    return bankAccountRow;
};

export default selectActiveBankAccountByNumber;
