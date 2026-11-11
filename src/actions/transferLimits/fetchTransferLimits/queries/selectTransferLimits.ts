import { Kysely } from "kysely";
import { db } from "@/database";
import { Database } from "@/database/types";
import TRANSFERS from "@/constants/transfers";

/** The limits everyone uses today (scope 'default'). Seeded by the migration. */
const selectTransferLimits = async ({ trx = db }: { trx?: Kysely<Database> } = {}) => {
    const limitsRow = await trx
        .selectFrom("transfer_limits")
        .select(["minAmount", "maxPerTransfer", "maxPerDay"])
        .where("scope", "=", TRANSFERS.DEFAULT_SCOPE)
        .where("currency", "=", TRANSFERS.CURRENCY)
        .executeTakeFirstOrThrow();

    return limitsRow;
};

export default selectTransferLimits;
