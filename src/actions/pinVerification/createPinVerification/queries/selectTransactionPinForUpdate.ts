import { Kysely } from "kysely";
import { Database } from "@/database/types";

// FOR UPDATE serialises concurrent guesses so every attempt is counted.
const selectTransactionPinForUpdate = async ({ trx, userId }: { trx: Kysely<Database>; userId: string }) => {
    const transactionPinRow = await trx
        .selectFrom("transaction_pins")
        .select(["userId", "pinHash", "failedAttempts", "lockedUntil"])
        .where("userId", "=", userId)
        .forUpdate()
        .executeTakeFirst();

    return transactionPinRow;
};

export default selectTransactionPinForUpdate;
