import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Row lock: a webhook and the reconciler can't credit the same deposit twice. */
const selectNairaDepositForUpdate = async ({ trx, id }: { trx: Kysely<Database>; id: string }) => {
    const depositRow = await trx
        .selectFrom("naira_deposits")
        .select(["id", "userId", "provider", "status", "currency", "amount", "feeBearer", "fee"])
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirstOrThrow();

    return depositRow;
};

export default selectNairaDepositForUpdate;
