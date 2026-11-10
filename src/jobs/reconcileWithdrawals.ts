import payoutProviderRegistry from "@/services/payouts/payoutProviderRegistry";
import fetchOpenWithdrawals from "@/actions/withdrawals/fetchOpenWithdrawals";
import syncWithdrawal from "@/actions/withdrawal/syncWithdrawal";
import monitoring from "@/utils/monitoring";

/**
 * Catches what webhooks missed: re-checks open withdrawals with THEIR provider
 * (settle, refund, or keep waiting). Least recently checked first, a batch per run.
 */
const reconcileWithdrawals = async () => {
    const { data: withdrawals } = await fetchOpenWithdrawals();
    for (const withdrawal of withdrawals) {
        if (!payoutProviderRegistry.has({ name: withdrawal.provider })) continue;
        try {
            await syncWithdrawal({ withdrawalId: withdrawal.id });
        } catch (error) {
            monitoring.error(`Reconcile: withdrawal ${withdrawal.id} (${withdrawal.provider}) failed`, error as Error);
        }
    }
};

export default reconcileWithdrawals;
