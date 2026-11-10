import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateNairaDepositCompleted {
    trx: Kysely<Database>;
    id: string;
    providerReference: string | null;
    amountReceived: string;
    providerFee: string;
    amountCredited: string;
    paidAt: Date;
    ledgerTransactionId: string;
}

/** Final. A provider reference already recorded is kept (the table guard forbids changing it). */
const updateNairaDepositCompleted = async ({
    trx,
    id,
    providerReference,
    amountReceived,
    providerFee,
    amountCredited,
    paidAt,
    ledgerTransactionId,
}: IUpdateNairaDepositCompleted) => {
    const now = new Date();
    const depositRow = await trx
        .updateTable("naira_deposits")
        .set((eb) => ({
            status: "completed",
            providerReference: eb.fn.coalesce("providerReference", eb.val(providerReference)),
            amountReceived,
            providerFee,
            amountCredited,
            paidAt,
            ledgerTransactionId,
            finalizedAt: now,
            updatedAt: now,
        }))
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return depositRow;
};

export default updateNairaDepositCompleted;
