import { db } from "@/database";

const selectBillPaymentIdByIdempotencyKey = async ({ userId, idempotencyKey }: { userId: string; idempotencyKey: string }) => {
    const paymentRow = await db
        .selectFrom("bill_payments")
        .select(["id"])
        .where("userId", "=", userId)
        .where("idempotencyKey", "=", idempotencyKey)
        .executeTakeFirst();

    return paymentRow;
};

export default selectBillPaymentIdByIdempotencyKey;
