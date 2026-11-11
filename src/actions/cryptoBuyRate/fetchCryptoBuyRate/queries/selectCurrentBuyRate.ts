import { db } from "@/database";

/** The newest rate for a coin that has started (it may have expired — the caller checks). */
const selectCurrentBuyRate = async ({ symbol, currency, now }: { symbol: string; currency: string; now: Date }) => {
    const rateRow = await db
        .selectFrom("crypto_buy_rates")
        .select(["id", "symbol", "rate", "markupPercent", "effectiveFrom", "expiresAt"])
        .where("symbol", "=", symbol)
        .where("currency", "=", currency)
        .where("effectiveFrom", "<=", now)
        .orderBy("effectiveFrom", "desc")
        .limit(1)
        .executeTakeFirst();

    return rateRow;
};

export default selectCurrentBuyRate;
