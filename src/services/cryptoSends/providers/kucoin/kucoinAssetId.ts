import { CRYPTO_SEND_ERROR_CODE } from "@/constants/cryptoPurchases";
import CryptoSendProviderError from "../../cryptoSendProviderError";

/** "USDT:trx" ⇄ { currency: "USDT", chain: "trx" } — our opaque key for a KuCoin coin+chain. */
export const toProviderAssetId = ({ currency, chain }: { currency: string; chain: string }) => `${currency}:${chain}`;

export const fromProviderAssetId = ({ providerAssetId }: { providerAssetId: string }) => {
    const [currency, chain] = providerAssetId.split(":");
    if (!currency || !chain) throw new CryptoSendProviderError({ code: CRYPTO_SEND_ERROR_CODE.CONFIGURATION, status: null, providerMessage: `Bad KuCoin asset id "${providerAssetId}"` });
    return { currency, chain };
};
