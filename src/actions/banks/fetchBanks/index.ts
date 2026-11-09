import providerRegistry from "@/services/crypto/providerRegistry";
import getProviderEnvironment from "@/utils/crypto/getProviderEnvironment";
import selectPayoutBanks from "./queries/selectPayoutBanks";

/** Banks the active provider can verify accounts for. */
const fetchBanks = async () => {
    const data = await selectPayoutBanks({
        provider: providerRegistry.active().name,
        environment: getProviderEnvironment(),
    });

    return { data };
};

export default fetchBanks;
