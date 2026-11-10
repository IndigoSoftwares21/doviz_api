import toBillPaymentView from "@/utils/bills/toBillPaymentView";
import selectBillPayment from "./queries/selectBillPayment";

/**
 * One of the user's bill payments, as we have it. Never calls the provider:
 * status changes come from the webhook, follow-up checks and the reconciler,
 * and are pushed to the app over the socket.
 */
const fetchBillPayment = async ({ userId, billPaymentId }: { userId: string; billPaymentId: string }) => {
    const row = await selectBillPayment({ id: billPaymentId, userId });
    if (!row) return { data: null };

    return { data: toBillPaymentView({ row }) };
};

export default fetchBillPayment;
