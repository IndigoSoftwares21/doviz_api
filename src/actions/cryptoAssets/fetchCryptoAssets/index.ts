import Decimal from "decimal.js";
import providerRegistry from "@/services/crypto/providerRegistry";
import getProviderEnvironment from "@/utils/crypto/getProviderEnvironment";
import monitoring from "@/utils/monitoring";
import selectCryptoAssets from "./queries/selectCryptoAssets";

/**
 * Coins users can deposit right now: enabled and supported by the active
 * provider. `minDeposit` is always in COIN units: live from the provider when
 * it can say (its minimum may follow the price), else the synced catalog's.
 * A failed live lookup falls back to the catalog (null = no minimum shown).
 */
const fetchCryptoAssets = async () => {
    const provider = providerRegistry.active();
    const rows = await selectCryptoAssets({ provider: provider.name, environment: getProviderEnvironment() });

    const data = await Promise.all(
        rows.map(async ({ providerAssetId, minDeposit, ...asset }) => {
            let minimum = minDeposit === null ? null : new Decimal(minDeposit).toFixed();
            if (provider.getMinDeposit) {
                try {
                    minimum = (await provider.getMinDeposit({ providerAssetId })) ?? minimum;
                } catch (error) {
                    monitoring.warn(`${provider.name}: live minimum for ${providerAssetId} failed (${(error as Error).message})`);
                }
            }
            return { ...asset, minDeposit: minimum };
        }),
    );

    return { data };
};

export default fetchCryptoAssets;
