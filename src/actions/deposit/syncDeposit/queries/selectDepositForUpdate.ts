import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Row lock: concurrent webhooks and the reconciler process a deposit one at a time. */
const selectDepositForUpdate = async ({ trx, provider, reference }: { trx: Kysely<Database>; provider: string; reference: string }) => {
    const depositRow = await trx
        .selectFrom("crypto_deposits")
        .select(["id", "status", "lastEventAt"])
        .where("provider", "=", provider)
        .where("providerReference", "=", reference)
        .forUpdate()
        .executeTakeFirstOrThrow();

    return depositRow;
};

export default selectDepositForUpdate;
