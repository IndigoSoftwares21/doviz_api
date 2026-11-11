import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { ProviderTransferSender } from "@/services/collections/types";

interface IUpdateNairaDepositCompleted {
    trx: Kysely<Database>;
    id: string;
    providerReference: string | null;
    amountReceived: string;
    providerFee: string;
    amountCredited: string;
    paidAt: Date;
    ledgerTransactionId: string;
    /** Who sent it, when the provider says. */
    sender: ProviderTransferSender | null;
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
    sender,
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
            senderName: sender?.name ?? null,
            senderBankName: sender?.bankName ?? null,
            senderBankCode: sender?.bankCode ?? null,
            senderAccountNumber: sender?.accountNumber ?? null,
            finalizedAt: now,
            updatedAt: now,
        }))
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return depositRow;
};

export default updateNairaDepositCompleted;
