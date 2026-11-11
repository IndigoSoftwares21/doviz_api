import syncCryptoPurchase from "@/actions/cryptoPurchase/syncCryptoPurchase";
import monitoring from "@/utils/monitoring";
import CRYPTO_PURCHASES, { CRYPTO_PURCHASE_SYNC_OUTCOME } from "@/constants/cryptoPurchases";

/**
 * Checks a new purchase with its provider a few times in its first minutes,
 * so the app hears the result (via the socket) quickly — most providers don't
 * push. A fixed handful of timers that never keep the process alive; the
 * reconciler takes over after. Not run in tests.
 */
const scheduleCryptoPurchaseChecks = ({ purchaseId }: { purchaseId: string }) => {
    if (process.env.NODE_ENV === "test") return;
    const schedule = CRYPTO_PURCHASES.FOLLOW_UP_CHECKS_MS;

    const checkAt = (step: number) => {
        if (step >= schedule.length) return;
        const wait = schedule[step] - (step === 0 ? 0 : schedule[step - 1]);
        setTimeout(async () => {
            try {
                const { data } = await syncCryptoPurchase({ purchaseId });
                if (data.outcome === CRYPTO_PURCHASE_SYNC_OUTCOME.PENDING) checkAt(step + 1);
            } catch (error) {
                monitoring.warn(`Crypto purchase ${purchaseId}: follow-up check failed (${(error as Error).message})`);
                checkAt(step + 1);
            }
        }, wait).unref();
    };

    checkAt(0);
};

export default scheduleCryptoPurchaseChecks;
