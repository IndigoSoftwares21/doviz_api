import { db } from "@/database";

const selectBillPaymentForSync = async ({ id }: { id: string }) => {
    const paymentRow = await db
        .selectFrom("bill_payments")
        .select(["id", "provider", "status", "providerReference", "requestedAt"])
        .where("id", "=", id)
        .executeTakeFirst();

    return paymentRow;
};

export default selectBillPaymentForSync;
