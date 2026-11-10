import { db } from "@/database";

/** Pending / processing payments requested before `requestedBefore`, least recently checked first. */
const selectOpenBillPayments = async ({ requestedBefore, limit }: { requestedBefore: Date; limit: number }) => {
    const paymentRows = await db
        .selectFrom("bill_payments")
        .select(["id", "provider"])
        .where("status", "in", ["pending", "processing"])
        .where("requestedAt", "<", requestedBefore)
        .orderBy("updatedAt")
        .limit(limit)
        .execute();

    return paymentRows;
};

export default selectOpenBillPayments;
