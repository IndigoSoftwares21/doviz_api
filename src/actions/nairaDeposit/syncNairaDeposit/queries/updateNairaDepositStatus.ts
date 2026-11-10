import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateNairaDepositStatus {
    trx: Kysely<Database>;
    id: string;
    from: string;
    status: string;
    failureReason: string | null;
    final: boolean;
}

/** Moves an unpaid deposit on (pending → expired / failed). Only from `from`, so a credit that just landed wins. */
const updateNairaDepositStatus = async ({ trx, id, from, status, failureReason, final }: IUpdateNairaDepositStatus) => {
    const now = new Date();
    const depositRow = await trx
        .updateTable("naira_deposits")
        .set({ status, failureReason, updatedAt: now, ...(final ? { finalizedAt: now } : {}) })
        .where("id", "=", id)
        .where("status", "=", from)
        .returning(["id"])
        .executeTakeFirst();

    return depositRow;
};

export default updateNairaDepositStatus;
