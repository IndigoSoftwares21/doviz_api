import syncBillPayment from "@/actions/billPayment/syncBillPayment";
import toBillPaymentView from "@/utils/bills/toBillPaymentView";
import monitoring from "@/utils/monitoring";
import selectBillPayment from "./queries/selectBillPayment";
import BILLS, { BILL_PAYMENT_STATUS } from "@/constants/bills";

const OPEN: string[] = [BILL_PAYMENT_STATUS.PENDING, BILL_PAYMENT_STATUS.PROCESSING];

/**
 * One of the user's bill payments. With `refresh`, an open payment not
 * checked in the last few seconds is re-checked with the provider first, so
 * an app polling for the result sees it as soon as the provider has it —
 * without waiting for the webhook or reconciler.
 */
const fetchBillPayment = async ({ userId, billPaymentId, refresh }: { userId: string; billPaymentId: string; refresh: boolean }) => {
    let row = await selectBillPayment({ id: billPaymentId, userId });
    if (!row) return { data: null };

    const stale = Date.now() - row.updatedAt.getTime() > BILLS.REFRESH_ON_READ_AFTER_MS;
    if (refresh && OPEN.includes(row.status) && stale) {
        try {
            await syncBillPayment({ billPaymentId });
            row = (await selectBillPayment({ id: billPaymentId, userId })) ?? row;
        } catch (error) {
            monitoring.warn(`Bill payment ${billPaymentId}: refresh on read failed (${(error as Error).message})`);
        }
    }

    return { data: toBillPaymentView({ row }) };
};

export default fetchBillPayment;
