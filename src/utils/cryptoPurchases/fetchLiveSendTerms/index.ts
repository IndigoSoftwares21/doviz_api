import { CryptoSendProvider } from "@/services/cryptoSends/cryptoSendProvider";
import { ProviderSendTerms } from "@/services/cryptoSends/types";
import getCachedValue from "@/utils/crypto/getCachedValue";
import monitoring from "@/utils/monitoring";
import CRYPTO_PURCHASES from "@/constants/cryptoPurchases";

/**
 * Every coin+network's fee, minimum, precision and on/off straight from the
 * provider (KuCoin: its public currency endpoint, no key or IP needed),
 * cached briefly. Keyed by providerAssetId. null when the provider can't be
 * reached: callers then fall back to the synced catalog.
 */
const fetchLiveSendTerms = async ({ provider }: { provider: CryptoSendProvider }): Promise<Map<string, ProviderSendTerms> | null> => {
    try {
        const { value } = await getCachedValue({
            key: `crypto-send-catalog:${provider.name}:${provider.environment}`,
            ttlSeconds: CRYPTO_PURCHASES.SEND_TERMS_CACHE_MS / 1000,
            load: () => provider.listSendableAssets(),
        });
        return new Map(value.map((asset) => [asset.providerAssetId, asset.terms]));
    } catch (error) {
        monitoring.warn(`${provider.name}: live send terms failed (${(error as Error).message}) — using the synced catalog`);
        return null;
    }
};

export default fetchLiveSendTerms;
