import Decimal from "decimal.js";
import { CryptoSendProvider } from "@/services/cryptoSends/cryptoSendProvider";
import getCachedValue from "@/utils/crypto/getCachedValue";
import monitoring from "@/utils/monitoring";
import CRYPTO_PURCHASES from "@/constants/cryptoPurchases";

/** The last live price we accepted, per provider + coin (this process). */
const accepted = new Map<string, { price: Decimal; at: number }>();

/** Test hook: forget accepted prices. */
export const resetMarketPrices = () => accepted.clear();

/**
 * One coin's live USDT price from the provider, cached briefly. null — the coin
 * is unavailable, never priced on a guess — when the provider can't price it,
 * the lookup fails, the price isn't positive, or it jumped more than
 * MARKET_PRICE_MAX_JUMP_PERCENT from one we used under a minute ago.
 */
const fetchMarketPrice = async ({ provider, symbol }: { provider: CryptoSendProvider; symbol: string }) => {
    const { getUsdtPrice } = provider;
    if (!getUsdtPrice) return null;

    const key = `${provider.name}:${provider.environment}:${symbol}`;
    let price: Decimal;
    try {
        const { value } = await getCachedValue({
            key: `crypto-market-price:${key}`,
            ttlSeconds: CRYPTO_PURCHASES.MARKET_PRICE_CACHE_MS / 1000,
            load: () => getUsdtPrice.call(provider, { symbol }),
        });
        price = new Decimal(value);
    } catch (error) {
        monitoring.warn(`${provider.name}: ${symbol} price unavailable (${(error as Error).message})`);
        return null;
    }
    if (!price.isFinite() || price.lessThanOrEqualTo(0)) return null;

    const now = Date.now();
    const last = accepted.get(key);
    if (last && now - last.at < CRYPTO_PURCHASES.MARKET_PRICE_JUMP_WINDOW_MS) {
        const movedPercent = price.minus(last.price).abs().dividedBy(last.price).times(100);
        if (movedPercent.greaterThan(CRYPTO_PURCHASES.MARKET_PRICE_MAX_JUMP_PERCENT)) {
            monitoring.warn(`${provider.name}: ${symbol} price ${price} is ${movedPercent.toFixed(1)}% from ${last.price} a moment ago — refused`);
            return null;
        }
    }
    accepted.set(key, { price, at: now });
    return price.toFixed();
};

export default fetchMarketPrice;
