import cryptoSendProviderRegistry from "@/services/cryptoSends/cryptoSendProviderRegistry";
import selectActiveCryptoSendProviderName from "./queries/selectActiveCryptoSendProviderName";

/**
 * The provider for NEW crypto purchases, read from provider_settings each time
 * so a switch takes effect without a restart. data is null when none is set or
 * the one set isn't registered (no credentials) — buying is then unavailable.
 */
const fetchActiveCryptoSendProvider = async () => {
    const setting = await selectActiveCryptoSendProviderName();
    if (!setting || !cryptoSendProviderRegistry.has({ name: setting.activeProvider })) return { data: null };

    return { data: cryptoSendProviderRegistry.get({ name: setting.activeProvider }) };
};

export default fetchActiveCryptoSendProvider;
