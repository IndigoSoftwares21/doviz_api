import toBillPaymentView from "@/utils/bills/toBillPaymentView";
import selectBillPayments from "./queries/selectBillPayments";

/** A page of the user's bill payments, newest first. One extra row is read to know if there's more. */
const fetchBillPayments = async ({ userId, limit, offset }: { userId: string; limit: number; offset: number }) => {
    const rows = await selectBillPayments({ userId, limit: limit + 1, offset });

    const data = {
        items: rows.slice(0, limit).map((row) => toBillPaymentView({ row })),
        limit,
        offset,
        hasMore: rows.length > limit,
    };

    return { data };
};

export default fetchBillPayments;
