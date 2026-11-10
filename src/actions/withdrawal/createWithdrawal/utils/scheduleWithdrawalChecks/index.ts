import syncWithdrawal from "@/actions/withdrawal/syncWithdrawal";
import monitoring from "@/utils/monitoring";
import WITHDRAWALS, { WITHDRAWAL_SYNC_OUTCOME } from "@/constants/withdrawals";

/**
 * Checks a new withdrawal with its provider a few times in its first minute,
 * so the app hears the result (via the socket) quickly even if a webhook is
 * late. A fixed handful of timers that never keep the process alive; the
 * reconciler takes over after. Not run in tests.
 */
const scheduleWithdrawalChecks = ({ withdrawalId }: { withdrawalId: string }) => {
    if (process.env.NODE_ENV === "test") return;
    const schedule = WITHDRAWALS.FOLLOW_UP_CHECKS_MS;

    const checkAt = (step: number) => {
        if (step >= schedule.length) return;
        const wait = schedule[step] - (step === 0 ? 0 : schedule[step - 1]);
        setTimeout(async () => {
            try {
                const { data } = await syncWithdrawal({ withdrawalId });
                if (data.outcome === WITHDRAWAL_SYNC_OUTCOME.PENDING) checkAt(step + 1);
            } catch (error) {
                monitoring.warn(`Withdrawal ${withdrawalId}: follow-up check failed (${(error as Error).message})`);
                checkAt(step + 1);
            }
        }, wait).unref();
    };

    checkAt(0);
};

export default scheduleWithdrawalChecks;
