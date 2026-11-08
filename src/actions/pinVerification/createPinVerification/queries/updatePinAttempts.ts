import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdatePinAttempts {
    trx: Kysely<Database>;
    userId: string;
    failedAttempts: number;
    lockedUntil: Date | null;
}

const updatePinAttempts = async ({ trx, userId, failedAttempts, lockedUntil }: IUpdatePinAttempts) => {
    const transactionPinRow = await trx
        .updateTable("transaction_pins")
        .set({ failedAttempts, lockedUntil })
        .where("userId", "=", userId)
        .returning(["userId", "failedAttempts", "lockedUntil"])
        .executeTakeFirstOrThrow();

    return transactionPinRow;
};

export default updatePinAttempts;
