import collectionProviderRegistry from "@/services/collections/collectionProviderRegistry";
import fetchOpenNairaDeposits from "@/actions/nairaDeposits/fetchOpenNairaDeposits";
import syncNairaDeposit from "@/actions/nairaDeposit/syncNairaDeposit";
import monitoring from "@/utils/monitoring";

/**
 * Catches what webhooks missed: re-checks open (and recently expired)
 * deposits with their provider — credit, expire, or keep waiting. Least
 * recently checked first, a batch per run.
 */
const reconcileNairaDeposits = async () => {
    const { data: deposits } = await fetchOpenNairaDeposits();
    for (const deposit of deposits) {
        if (!collectionProviderRegistry.has({ name: deposit.provider })) continue;
        try {
            await syncNairaDeposit({ nairaDepositId: deposit.id });
        } catch (error) {
            monitoring.error(`Reconcile: naira deposit ${deposit.id} (${deposit.provider}) failed`, error as Error);
        }
    }
};

export default reconcileNairaDeposits;
