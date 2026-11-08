import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertTransactionPin {
    trx: Kysely<Database>;
    userId: string;
    pinHash: string;
}

const insertTransactionPin = async ({ trx, userId, pinHash }: IInsertTransactionPin) => {
    const transactionPinRow = await trx
        .insertInto("transaction_pins")
        .values({ userId, pinHash, failedAttempts: 0, lockedUntil: null })
        .returning(["userId", "createdAt"])
        .executeTakeFirstOrThrow();

    return transactionPinRow;
};

export default insertTransactionPin;
