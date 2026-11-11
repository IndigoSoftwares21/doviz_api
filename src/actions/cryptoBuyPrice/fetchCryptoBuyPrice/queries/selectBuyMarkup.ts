import { db } from "@/database";

/** The markup set for a market-priced coin, if any. */
const selectBuyMarkup = async ({ symbol }: { symbol: string }) => {
    const markupRow = await db.selectFrom("crypto_buy_markups").select(["markupPercent"]).where("symbol", "=", symbol).executeTakeFirst();

    return markupRow;
};

export default selectBuyMarkup;
