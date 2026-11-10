import selectOpenBillPayments from "./queries/selectOpenBillPayments";
import BILLS from "@/constants/bills";

/** Open payments old enough for the reconciler (the request that made one handles it first). */
const fetchOpenBillPayments = async () => {
    const data = await selectOpenBillPayments({
        requestedBefore: new Date(Date.now() - BILLS.RECONCILE_MIN_AGE_MS),
        limit: BILLS.RECONCILE_BATCH_SIZE,
    });

    return { data };
};

export default fetchOpenBillPayments;
