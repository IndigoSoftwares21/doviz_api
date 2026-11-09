import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** The markup in force now for this coin (latest effective_from that has started). */
const selectCurrentMarkup = async ({ trx, assetId, currency }: { trx: Kysely<Database>; assetId: string; currency: string }) => {
    const markupRow = await trx
        .selectFrom("conversion_markups")
        .select(["id", "markupPercent"])
        .where("assetId", "=", assetId)
        .where("currency", "=", currency)
        .where("effectiveFrom", "<=", new Date())
        .orderBy("effectiveFrom", "desc")
        .limit(1)
        .executeTakeFirst();

    return markupRow;
};

export default selectCurrentMarkup;
