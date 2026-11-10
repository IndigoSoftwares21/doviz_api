import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** The user's available balance, locked for the rest of the transaction. */
const selectUserAvailableBalance = async ({ trx, userId, currency }: { trx: Kysely<Database>; userId: string; currency: string }) => {
    const accountRow = await trx
        .selectFrom("ledger_accounts")
        .select(["balance"])
        .where("kind", "=", "user_available")
        .where("userId", "=", userId)
        .where("currency", "=", currency)
        .forUpdate()
        .executeTakeFirst();

    return accountRow;
};

export default selectUserAvailableBalance;
