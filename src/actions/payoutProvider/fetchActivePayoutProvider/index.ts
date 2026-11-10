import payoutProviderRegistry from "@/services/payouts/payoutProviderRegistry";
import selectActivePayoutProviderName from "./queries/selectActivePayoutProviderName";

/**
 * The provider for NEW withdrawals, read from provider_settings each time so a
 * switch takes effect without a restart. Throws when none is set or the one
 * set isn't registered (missing credentials) — nothing is held then.
 */
const fetchActivePayoutProvider = async () => {
    const setting = await selectActivePayoutProviderName();
    if (!setting) throw new Error("No active payout provider in provider_settings");

    const data = payoutProviderRegistry.get({ name: setting.activeProvider });

    return { data };
};

export default fetchActivePayoutProvider;
