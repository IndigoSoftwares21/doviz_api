import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { BANK_ACCOUNT_STATUS } from "@/constants/cryptoStatus";

interface IInsertBankAccount {
    trx: Kysely<Database>;
    userId: string;
    bankId: string;
    accountNumber: string;
    accountName: string;
    isPrimary: boolean;
    verifiedAt: Date;
}

const insertBankAccount = async ({ trx, userId, bankId, accountNumber, accountName, isPrimary, verifiedAt }: IInsertBankAccount) => {
    const bankAccountRow = await trx
        .insertInto("user_bank_accounts")
        .values({ userId, payoutBankId: bankId, accountNumber, accountName, isPrimary, verifiedAt, status: BANK_ACCOUNT_STATUS.ACTIVE })
        .returning(["id", "accountNumber", "accountName", "isPrimary", "verifiedAt"])
        .executeTakeFirstOrThrow();

    return bankAccountRow;
};

export default insertBankAccount;
