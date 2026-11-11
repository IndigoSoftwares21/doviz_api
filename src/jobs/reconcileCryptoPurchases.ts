import cryptoSendProviderRegistry from "@/services/cryptoSends/cryptoSendProviderRegistry";
import fetchOpenCryptoPurchases from "@/actions/cryptoPurchases/fetchOpenCryptoPurchases";
import syncCryptoPurchase from "@/actions/cryptoPurchase/syncCryptoPurchase";
import monitoring from "@/utils/monitoring";

/**
 * The safety net (most providers don't push results): re-checks open
 * purchases with THEIR provider — settle, refund on a confirmed failure, keep
 * waiting, or flag for review. Least recently checked first, a batch per run.
 */
const reconcileCryptoPurchases = async () => {
    const { data: purchases } = await fetchOpenCryptoPurchases();
    for (const purchase of purchases) {
        if (!cryptoSendProviderRegistry.has({ name: purchase.provider })) continue;
        try {
            await syncCryptoPurchase({ purchaseId: purchase.id });
        } catch (error) {
            monitoring.error(`Reconcile: crypto purchase ${purchase.id} (${purchase.provider}) failed`, error as Error);
        }
    }
};

export default reconcileCryptoPurchases;
