import selectOpenNairaDeposits from "./queries/selectOpenNairaDeposits";
import NAIRA_DEPOSITS from "@/constants/nairaDeposits";

/** Deposits the reconciler should re-check with their provider. */
const fetchOpenNairaDeposits = async () => {
    const now = Date.now();
    const data = await selectOpenNairaDeposits({
        createdBefore: new Date(now - NAIRA_DEPOSITS.RECONCILE_MIN_AGE_MS),
        expiredAfter: new Date(now - NAIRA_DEPOSITS.LATE_PAYMENT_WINDOW_MS),
        limit: NAIRA_DEPOSITS.RECONCILE_BATCH_SIZE,
    });

    return { data };
};

export default fetchOpenNairaDeposits;
