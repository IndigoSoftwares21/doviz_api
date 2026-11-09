import providerRegistry from "@/services/crypto/providerRegistry";
import getProviderEnvironment from "@/utils/crypto/getProviderEnvironment";
import selectCryptoAssets from "./queries/selectCryptoAssets";

/** Coins users can deposit right now: enabled and supported by the active provider. */
const fetchCryptoAssets = async () => {
    const data = await selectCryptoAssets({
        provider: providerRegistry.active().name,
        environment: getProviderEnvironment(),
    });

    return { data };
};

export default fetchCryptoAssets;
