import { db } from "@/database";

/** The user's newest deposit whose account can still be paid into (pending, not yet past expiry). */
const selectActiveNairaDeposit = async ({ userId, now }: { userId: string; now: Date }) => {
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
            "senderName",
            "senderBankName",
            "senderAccountNumber",
        ])
        .where("userId", "=", userId)
        .where("status", "=", "pending")
        .where("expiresAt", ">", now)
        .orderBy("createdAt", "desc")
        .limit(1)
        .executeTakeFirst();

    return depositRow;
};

export default selectActiveNairaDeposit;
