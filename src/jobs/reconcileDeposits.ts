import providerRegistry from "@/services/crypto/providerRegistry";
import fetchOpenDeposits from "@/actions/deposit/fetchOpenDeposits";
import fetchDepositProviders from "@/actions/deposit/fetchDepositProviders";
import syncDeposit from "@/actions/deposit/syncDeposit";
import monitoring from "@/utils/monitoring";

const LOOKBACK_MS = 48 * 60 * 60 * 1000;

const safeSync = async ({ provider, reference }: { provider: string; reference: string }) => {
    try {
        await syncDeposit({ provider, reference });
    } catch (error) {
        monitoring.error(`Reconcile: deposit ${reference} (${provider}) failed`, error as Error);
    }
};

/**
 * Catches what webhooks missed: re-syncs every open deposit, and asks each
 * provider for recent deposits (providers can stop sending webhooks).
 */
const reconcileDeposits = async () => {
    const { data: openDeposits } = await fetchOpenDeposits();
    for (const deposit of openDeposits) {
        if (providerRegistry.has({ name: deposit.provider })) {
            await safeSync({ provider: deposit.provider, reference: deposit.providerReference });
        }
    }

    const { data: providers } = await fetchDepositProviders();
    const since = new Date(Date.now() - LOOKBACK_MS);
    for (const provider of providers.filter((name) => providerRegistry.has({ name }))) {
        try {
            const recent = await providerRegistry.get({ name: provider }).listRecentDeposits({ since });
            for (const deposit of recent) {
                await safeSync({ provider, reference: deposit.reference });
            }
        } catch (error) {
            monitoring.error(`Reconcile: listing ${provider} deposits failed`, error as Error);
        }
    }
};

export default reconcileDeposits;
