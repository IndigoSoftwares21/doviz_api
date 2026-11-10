import { db } from "@/database";

/** One of the user's own naira deposits (never anyone else's). */
const selectNairaDeposit = async ({ id, userId }: { id: string; userId: string }) => {
    const depositRow = await db
        .selectFrom("naira_deposits")
        .select([
            "id",
            "status",
            "currency",
            "amount",
            "feeBearer",
            "fee",
            "amountToTransfer",
            "amountCredited",
            "accountName",
            "accountNumber",
            "bankName",
            "expiresAt",
            "failureReason",
            "createdAt",
            "finalizedAt",
        ])
        .where("id", "=", id)
        .where("userId", "=", userId)
        .executeTakeFirst();

    return depositRow;
};

export default selectNairaDeposit;
