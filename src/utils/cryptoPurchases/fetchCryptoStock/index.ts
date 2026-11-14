import { CryptoSendProvider } from "@/services/cryptoSends/cryptoSendProvider";
import getCachedValue from "@/utils/crypto/getCachedValue";
import monitoring from "@/utils/monitoring";
import CRYPTO_PURCHASES from "@/constants/cryptoPurchases";

export type CryptoStock =
    /** The provider told us how much of the coin it holds. */
    | { status: "known"; balance: string }
    /** The provider can't report a balance at all (no getBalance): no cap. */
    | { status: "unlimited" }
    /** The lookup failed: treat as nothing to sell, never as unlimited. */
    | { status: "unknown" };

/**
 * How much of a coin the provider can send from right now, cached briefly so
 * the asset list and every quote keystroke don't each hit the provider.
 * Stock is per coin (KuCoin holds one USDT balance for every network), so the
 * cache is keyed by symbol. A failed lookup is `unknown`: buying that coin is
 * paused rather than risking a sale we can't fill.
 */
const fetchCryptoStock = async ({ provider, symbol, providerAssetId }: { provider: CryptoSendProvider; symbol: string; providerAssetId: string }): Promise<CryptoStock> => {
    const { getBalance } = provider;
    if (!getBalance) return { status: "unlimited" };

    try {
        const { value } = await getCachedValue({
            key: `crypto-stock:${provider.name}:${provider.environment}:${symbol}`,
            ttlSeconds: CRYPTO_PURCHASES.STOCK_CACHE_MS / 1000,
            load: () => getBalance.call(provider, { providerAssetId }),
        });
        return value === null ? { status: "unlimited" } : { status: "known", balance: value };
    } catch (error) {
        monitoring.warn(`${provider.name}: balance for ${symbol} failed (${(error as Error).message}) — buying it is paused`);
        return { status: "unknown" };
    }
};

export default fetchCryptoStock;
