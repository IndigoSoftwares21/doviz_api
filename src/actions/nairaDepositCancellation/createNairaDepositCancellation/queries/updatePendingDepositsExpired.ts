import { Kysely } from "kysely";
import { Database } from "@/database/types";

/**
 * Closes the user's unpaid top-ups early (pending → expired): one by id, or
 * all except `exceptId`. Only from pending, so a credit that just landed
 * wins. Expired top-ups are still credited if money arrives later.
 */
const updatePendingDepositsExpired = async ({ trx, userId, id, exceptId }: { trx: Kysely<Database>; userId: string; id?: string; exceptId?: string }) => {
    let query = trx
        .updateTable("naira_deposits")
        .set({ status: "expired", updatedAt: new Date() })
        .where("userId", "=", userId)
        .where("status", "=", "pending");
    if (id) query = query.where("id", "=", id);
    if (exceptId) query = query.where("id", "<>", exceptId);

    const depositRows = await query.returning(["id"]).execute();

    return depositRows;
};

export default updatePendingDepositsExpired;
