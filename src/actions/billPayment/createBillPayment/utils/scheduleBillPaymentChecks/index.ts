import syncBillPayment from "@/actions/billPayment/syncBillPayment";
import monitoring from "@/utils/monitoring";
import BILLS, { BILL_SYNC_OUTCOME } from "@/constants/bills";

/**
 * Checks a new payment with its provider a few times in its first minute, so
 * the app hears "delivered" / "refunded" (via the socket) within seconds even
 * without a provider webhook. Bounded: a fixed handful of timers per payment,
 * none of which keep the process alive; after the last one the 2-minute
 * reconciler takes over. Not run in tests.
 */
const scheduleBillPaymentChecks = ({ billPaymentId }: { billPaymentId: string }) => {
    if (process.env.NODE_ENV === "test") return;
    const schedule = BILLS.FOLLOW_UP_CHECKS_MS;

    const checkAt = (step: number) => {
        if (step >= schedule.length) return;
        const wait = schedule[step] - (step === 0 ? 0 : schedule[step - 1]);
        setTimeout(async () => {
            try {
                const { data } = await syncBillPayment({ billPaymentId });
                if (data.outcome === BILL_SYNC_OUTCOME.PENDING) checkAt(step + 1);
            } catch (error) {
                monitoring.warn(`Bill payment ${billPaymentId}: follow-up check failed (${(error as Error).message})`);
                checkAt(step + 1);
            }
        }, wait).unref();
    };

    checkAt(0);
};

export default scheduleBillPaymentChecks;
