import selectOpenWithdrawals from "./queries/selectOpenWithdrawals";
import WITHDRAWALS from "@/constants/withdrawals";

/** Open withdrawals old enough for the reconciler (the request that made one handles it first). */
const fetchOpenWithdrawals = async () => {
    const data = await selectOpenWithdrawals({
        requestedBefore: new Date(Date.now() - WITHDRAWALS.RECONCILE_MIN_AGE_MS),
        limit: WITHDRAWALS.RECONCILE_BATCH_SIZE,
    });

    return { data };
};

export default fetchOpenWithdrawals;
