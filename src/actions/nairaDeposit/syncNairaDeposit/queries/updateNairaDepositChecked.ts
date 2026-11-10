import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Still open: note that we checked (updatedAt orders the reconciler's queue). */
const updateNairaDepositChecked = async ({ trx, id }: { trx: Kysely<Database>; id: string }) => {
    const depositRow = await trx
        .updateTable("naira_deposits")
        .set({ updatedAt: new Date() })
        .where("id", "=", id)
        .where("status", "in", ["pending", "expired"])
        .returning(["id"])
        .executeTakeFirst();

    return depositRow;
};

export default updateNairaDepositChecked;
