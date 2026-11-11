import selectCurrentBuyRate from "./queries/selectCurrentBuyRate";
import CRYPTO_PURCHASES from "@/constants/cryptoPurchases";

/**
 * Our naira price for a coin right now. null when none has been set or the
 * newest has expired — buying that coin is then unavailable (a stale price is
 * how we'd lose money).
 */
const fetchCryptoBuyRate = async ({ symbol }: { symbol: string }) => {
    const now = new Date();
    const rate = await selectCurrentBuyRate({ symbol, currency: CRYPTO_PURCHASES.CURRENCY, now });
    if (!rate || rate.expiresAt <= now) return { data: null };

    return { data: { id: rate.id, rate: rate.rate, markupPercent: rate.markupPercent, expiresAt: rate.expiresAt } };
};

export default fetchCryptoBuyRate;
