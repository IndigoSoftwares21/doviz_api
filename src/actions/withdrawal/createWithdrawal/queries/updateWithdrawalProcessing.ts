import { db } from "@/database";

/** Outcome unknown (timeout, outage): leave it to the checks and reconciler. Never overrides a final status. */
const updateWithdrawalProcessing = async ({ id }: { id: string }) => {
    const withdrawalRow = await db
        .updateTable("bank_withdrawals")
        .set({ status: "processing", updatedAt: new Date() })
        .where("id", "=", id)
        .where("status", "=", "pending")
        .returning(["id"])
        .executeTakeFirst();

    return withdrawalRow;
};

export default updateWithdrawalProcessing;
