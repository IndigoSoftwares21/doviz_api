import Decimal from "decimal.js";
import fetchCryptoBuyRate from "@/actions/cryptoBuyRate/fetchCryptoBuyRate";
import { CryptoSendProvider } from "@/services/cryptoSends/cryptoSendProvider";
import selectBuyMarkup from "./queries/selectBuyMarkup";
import fetchMarketPrice from "./utils/fetchMarketPrice";
import CRYPTO_PURCHASES, { CRYPTO_PRICE_SOURCE, CryptoPriceSource } from "@/constants/cryptoPurchases";

export type CryptoBuyPrice = {
    /** The crypto_buy_rates row: the coin's own, or (market) the USDT one. */
    rateId: string;
    /** Naira per coin before markup. */
    rate: string;
    markupPercent: string;
    expiresAt: Date;
    source: CryptoPriceSource;
    /** The coin's live USDT price used (market only). */
    marketPriceUsdt: string | null;
};

/**
 * Our naira price for one coin right now, with the provider that will send it.
 * 1. A rate we set for this coin, while in force (always the case for USDT).
 * 2. Otherwise from the market: our USDT rate × the provider's live USDT price
 *    for the coin; markup = the USDT rate's + the coin's (crypto_buy_markups).
 * null → the coin can't be bought now (no USDT rate in force, or no trusted
 * live price). A stale price is how we'd lose money, so there's no fallback.
 */
const fetchCryptoBuyPrice = async ({ provider, symbol }: { provider: CryptoSendProvider; symbol: string }): Promise<{ data: CryptoBuyPrice | null }> => {
    const { data: own } = await fetchCryptoBuyRate({ symbol });
    if (own) return { data: { rateId: own.id, rate: own.rate, markupPercent: own.markupPercent, expiresAt: own.expiresAt, source: CRYPTO_PRICE_SOURCE.RATE, marketPriceUsdt: null } };
    if (symbol === CRYPTO_PURCHASES.BASE_SYMBOL) return { data: null };

    const { data: base } = await fetchCryptoBuyRate({ symbol: CRYPTO_PURCHASES.BASE_SYMBOL });
    if (!base) return { data: null };
    const marketPriceUsdt = await fetchMarketPrice({ provider, symbol });
    if (!marketPriceUsdt) return { data: null };

    const coinMarkup = (await selectBuyMarkup({ symbol }))?.markupPercent ?? CRYPTO_PURCHASES.DEFAULT_BUY_MARKUP_PERCENT;
    const quoteEnds = new Date(Date.now() + CRYPTO_PURCHASES.MARKET_QUOTE_TTL_MS);
    return {
        data: {
            rateId: base.id,
            rate: new Decimal(base.rate).times(marketPriceUsdt).toFixed(),
            markupPercent: new Decimal(base.markupPercent).plus(coinMarkup).toFixed(),
            expiresAt: base.expiresAt < quoteEnds ? base.expiresAt : quoteEnds,
            source: CRYPTO_PRICE_SOURCE.MARKET,
            marketPriceUsdt,
        },
    };
};

export default fetchCryptoBuyPrice;
