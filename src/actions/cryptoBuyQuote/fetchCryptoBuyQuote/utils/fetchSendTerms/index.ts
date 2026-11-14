import { CryptoSendProvider } from "@/services/cryptoSends/cryptoSendProvider";
import { ProviderSendTerms } from "@/services/cryptoSends/types";
import getCachedValue from "@/utils/crypto/getCachedValue";
import monitoring from "@/utils/monitoring";
import CRYPTO_PURCHASES from "@/constants/cryptoPurchases";
import fetchLiveSendTerms from "@/utils/cryptoPurchases/fetchLiveSendTerms";
import { BuyAssetRow } from "../../queries/selectBuyAsset";

const fromCatalog = (asset: BuyAssetRow): ProviderSendTerms | null => {
    if (asset.sendFee === null || asset.minSend === null || asset.sendPrecision === null) return null;
    return { fee: asset.sendFee, minAmount: asset.minSend, precision: asset.sendPrecision, memoRequired: asset.memoRequired, isEnabled: true };
};

/**
 * The provider's fee / minimum / precision for sending this coin, live (cached
 * briefly): the account's own terms when the provider reports them, else its
 * public catalog, else (provider unreachable) what the last sync stored.
 * null = we don't know the terms — buying that coin is then unavailable.
 */
const fetchSendTerms = async ({ provider, asset }: { provider: CryptoSendProvider; asset: BuyAssetRow }) => {
    const publicOrCatalog = async () => {
        const live = (await fetchLiveSendTerms({ provider }))?.get(asset.providerAssetId);
        return live ? { ...live, memoRequired: live.memoRequired || asset.memoRequired } : fromCatalog(asset);
    };
    const { getSendTerms } = provider;
    if (!getSendTerms) return publicOrCatalog();

    try {
        const { value } = await getCachedValue({
            key: `crypto-send-terms:${provider.name}:${provider.environment}:${asset.providerAssetId}`,
            ttlSeconds: CRYPTO_PURCHASES.SEND_TERMS_CACHE_MS / 1000,
            load: () => getSendTerms.call(provider, { providerAssetId: asset.providerAssetId }),
        });
        // The catalog knows memo requirements some live endpoints don't report.
        return { ...value, memoRequired: value.memoRequired || asset.memoRequired };
    } catch (error) {
        monitoring.warn(`${provider.name}: account send terms for ${asset.providerAssetId} failed (${(error as Error).message}) — using its public terms`);
        return publicOrCatalog();
    }
};

export default fetchSendTerms;
