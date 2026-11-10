import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateBillPaymentCompleted {
    trx: Kysely<Database>;
    id: string;
    providerCost: string;
    providerReference: string | null;
    token: string | null;
    ledgerTransactionId: string;
}

/** Final: a reference or token already recorded is kept (the table guard forbids changing them). */
const updateBillPaymentCompleted = async ({ trx, id, providerCost, providerReference, token, ledgerTransactionId }: IUpdateBillPaymentCompleted) => {
    const now = new Date();
    const paymentRow = await trx
        .updateTable("bill_payments")
        .set((eb) => ({
            status: "completed",
            providerCost,
            providerReference: eb.fn.coalesce("providerReference", eb.val(providerReference)),
            token: eb.fn.coalesce("token", eb.val(token)),
            finalLedgerTransactionId: ledgerTransactionId,
            finalizedAt: now,
            updatedAt: now,
        }))
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return paymentRow;
};

export default updateBillPaymentCompleted;
