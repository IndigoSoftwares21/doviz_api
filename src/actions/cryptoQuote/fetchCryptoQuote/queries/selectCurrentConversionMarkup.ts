import { db } from "@/database";

/** The markup in force at `at` for this coin → currency (latest effective_from <= at). */
const selectCurrentConversionMarkup = async ({
    assetId,
    currency,
    at,
}: {
    assetId: string;
    currency: string;
    at: Date;
}) => {
    const markupRow = await db
        .selectFrom("conversion_markups")
        .select(["id", "markupPercent", "effectiveFrom"])
        .where("assetId", "=", assetId)
        .where("currency", "=", currency)
        .where("effectiveFrom", "<=", at)
        .orderBy("effectiveFrom", "desc")
        .limit(1)
        .executeTakeFirst();

    return markupRow;
};

export default selectCurrentConversionMarkup;
