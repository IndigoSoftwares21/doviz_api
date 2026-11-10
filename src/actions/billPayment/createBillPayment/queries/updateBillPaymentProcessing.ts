import { db } from "@/database";

/** Outcome unknown (timeout, outage): leave it to the reconciler. Never overrides a final status. */
const updateBillPaymentProcessing = async ({ id }: { id: string }) => {
    const paymentRow = await db
        .updateTable("bill_payments")
        .set({ status: "processing", updatedAt: new Date() })
        .where("id", "=", id)
        .where("status", "=", "pending")
        .returning(["id"])
        .executeTakeFirst();

    return paymentRow;
};

export default updateBillPaymentProcessing;
