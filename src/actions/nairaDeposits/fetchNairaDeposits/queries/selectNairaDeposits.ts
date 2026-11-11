import { db } from "@/database";

/** The user's own naira deposits, newest first. */
const selectNairaDeposits = async ({ userId, limit, offset }: { userId: string; limit: number; offset: number }) => {
    const depositRows = await db
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
            "senderName",
            "senderBankName",
            "senderAccountNumber",
        ])
        .where("userId", "=", userId)
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc")
        .limit(limit)
        .offset(offset)
        .execute();

    return depositRows;
};

export default selectNairaDeposits;
