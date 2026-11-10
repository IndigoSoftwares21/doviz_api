import { db } from "@/database";

/** The provider accepted it: keep its reference (and a token if it sent one already). */
const updateBillPaymentSubmitted = async ({ id, providerReference, token }: { id: string; providerReference: string | null; token: string | null }) => {
    const paymentRow = await db
        .updateTable("bill_payments")
        .set((eb) => ({
            providerReference: eb.fn.coalesce("providerReference", eb.val(providerReference)),
            token: eb.fn.coalesce("token", eb.val(token)),
            updatedAt: new Date(),
        }))
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirst();

    return paymentRow;
};

export default updateBillPaymentSubmitted;
