import { db } from "@/database";

/** Pending / processing withdrawals requested before `requestedBefore`, least recently checked first. */
const selectOpenWithdrawals = async ({ requestedBefore, limit }: { requestedBefore: Date; limit: number }) => {
    const withdrawalRows = await db
        .selectFrom("bank_withdrawals")
        .select(["id", "provider"])
        .where("status", "in", ["pending", "processing"])
        .where("requestedAt", "<", requestedBefore)
        .orderBy("updatedAt")
        .limit(limit)
        .execute();

    return withdrawalRows;
};

export default selectOpenWithdrawals;
