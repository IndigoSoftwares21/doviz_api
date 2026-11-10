import { Kysely } from "kysely";
import { Database } from "@/database/types";

const updateWithdrawalFailed = async ({ trx, id, failureReason, ledgerTransactionId }: { trx: Kysely<Database>; id: string; failureReason: string; ledgerTransactionId: string }) => {
    const now = new Date();
    const withdrawalRow = await trx
        .updateTable("bank_withdrawals")
        .set({ status: "failed", failureReason: failureReason.slice(0, 255), finalLedgerTransactionId: ledgerTransactionId, finalizedAt: now, updatedAt: now })
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return withdrawalRow;
};

export default updateWithdrawalFailed;
