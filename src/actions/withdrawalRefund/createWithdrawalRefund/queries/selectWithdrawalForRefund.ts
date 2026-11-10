import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Row lock: settle and refund can't both happen. */
const selectWithdrawalForRefund = async ({ trx, id }: { trx: Kysely<Database>; id: string }) => {
    const withdrawalRow = await trx
        .selectFrom("bank_withdrawals")
        .select(["id", "userId", "provider", "status", "currency", "totalHeld"])
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirstOrThrow();

    return withdrawalRow;
};

export default selectWithdrawalForRefund;
