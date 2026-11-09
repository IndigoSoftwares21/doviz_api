import { Kysely } from "kysely";
import { Database } from "@/database/types";

const selectPrimaryBankAccount = async ({ trx, userId }: { trx: Kysely<Database>; userId: string }) => {
    const bankAccountRow = await trx
        .selectFrom("user_bank_accounts")
        .select(["id"])
        .where("userId", "=", userId)
        .where("isPrimary", "=", true)
        .forUpdate()
        .executeTakeFirst();

    return bankAccountRow;
};

export default selectPrimaryBankAccount;
