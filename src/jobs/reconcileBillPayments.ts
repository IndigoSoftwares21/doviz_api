import billProviderRegistry from "@/services/bills/billProviderRegistry";
import fetchOpenBillPayments from "@/actions/billPayments/fetchOpenBillPayments";
import syncBillPayment from "@/actions/billPayment/syncBillPayment";
import monitoring from "@/utils/monitoring";

/**
 * Catches what webhooks missed: re-checks open bill payments with their
 * provider (settle, refund, or keep waiting). Least recently checked first,
 * a batch per run, so a backlog drains over several runs.
 */
const reconcileBillPayments = async () => {
    const { data: payments } = await fetchOpenBillPayments();
    for (const payment of payments) {
        if (!billProviderRegistry.has({ name: payment.provider })) continue;
        try {
            await syncBillPayment({ billPaymentId: payment.id });
        } catch (error) {
            monitoring.error(`Reconcile: bill payment ${payment.id} (${payment.provider}) failed`, error as Error);
        }
    }
};

export default reconcileBillPayments;
