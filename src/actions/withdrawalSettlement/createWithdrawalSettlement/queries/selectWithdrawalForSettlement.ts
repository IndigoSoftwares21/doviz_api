import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Row lock: a webhook, the reconciler and follow-up checks can't settle or refund the same withdrawal twice. */
const selectWithdrawalForSettlement = async ({ trx, id }: { trx: Kysely<Database>; id: string }) => {
    const withdrawalRow = await trx
        .selectFrom("bank_withdrawals")
        .select(["id", "userId", "provider", "status", "currency", "amount", "feeReserve", "totalHeld"])
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirstOrThrow();

    return withdrawalRow;
};

export default selectWithdrawalForSettlement;
