import { db } from "@/database";

// Never selects pin_hash.
const selectTransactionPinStatus = async ({ userId }: { userId: string }) => {
    const transactionPinRow = await db
        .selectFrom("transaction_pins")
        .select(["lockedUntil", "updatedAt"])
        .where("userId", "=", userId)
        .executeTakeFirst();

    return transactionPinRow;
};

export default selectTransactionPinStatus;
