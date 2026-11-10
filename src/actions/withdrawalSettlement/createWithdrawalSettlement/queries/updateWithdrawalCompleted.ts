import { Kysely } from "kysely";
import { Database } from "@/database/types";

const updateWithdrawalCompleted = async ({
    trx,
    id,
    fee,
    providerReference,
    ledgerTransactionId,
}: {
    trx: Kysely<Database>;
    id: string;
    fee: string;
    providerReference: string | null;
    ledgerTransactionId: string;
}) => {
    const now = new Date();
    const withdrawalRow = await trx
        .updateTable("bank_withdrawals")
        .set((eb) => ({
            status: "completed",
            fee,
            providerReference: eb.fn.coalesce("providerReference", eb.val(providerReference)),
            finalLedgerTransactionId: ledgerTransactionId,
            finalizedAt: now,
            updatedAt: now,
        }))
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return withdrawalRow;
};

export default updateWithdrawalCompleted;
