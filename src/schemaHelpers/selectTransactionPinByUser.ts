import { db } from "@/database";

// Never selects pin_hash.
const selectTransactionPinByUser = async ({ userId }: { userId: string }) => {
    const transactionPinRow = await db
        .selectFrom("transaction_pins")
        .select(["userId", "lockedUntil"])
        .where("userId", "=", userId)
        .executeTakeFirst();

    return transactionPinRow;
};

export default selectTransactionPinByUser;
