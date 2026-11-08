import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdatePinHash {
    trx: Kysely<Database>;
    userId: string;
    pinHash: string;
    updatedAt: Date;
}

// Setting a new PIN also clears any failed attempts and lock.
const updatePinHash = async ({ trx, userId, pinHash, updatedAt }: IUpdatePinHash) => {
    const transactionPinRow = await trx
        .updateTable("transaction_pins")
        .set({ pinHash, failedAttempts: 0, lockedUntil: null, updatedAt })
        .where("userId", "=", userId)
        .returning(["userId", "updatedAt"])
        .executeTakeFirstOrThrow();

    return transactionPinRow;
};

export default updatePinHash;
