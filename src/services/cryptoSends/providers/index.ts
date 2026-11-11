import monitoring from "@/utils/monitoring";
import cryptoSendProviderRegistry from "../cryptoSendProviderRegistry";
import { CryptoSendProvider } from "../cryptoSendProvider";
import FakeCryptoSendProvider from "./fake/fakeCryptoSendProvider";
import KucoinCryptoSendProvider from "./kucoin/kucoinCryptoSendProvider";

const register = (provider: CryptoSendProvider) => {
    if (!cryptoSendProviderRegistry.has({ name: provider.name })) cryptoSendProviderRegistry.register(provider);
};

/**
 * Registers every configured crypto-send provider. Call once at startup. A
 * provider without credentials is skipped (with a warning), never
 * half-configured. The fake sender is registered outside production only.
 */
const registerCryptoSendProviders = () => {
    if (process.env.KUCOIN_API_KEY) register(new KucoinCryptoSendProvider());
    else monitoring.warn("KUCOIN_API_KEY is not set; the KuCoin crypto-send provider is disabled");

    if (process.env.NODE_ENV !== "production") register(new FakeCryptoSendProvider());
};

export default registerCryptoSendProviders;
