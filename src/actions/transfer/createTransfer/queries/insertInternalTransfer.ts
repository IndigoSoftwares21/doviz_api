import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { TRANSFER_STATUS } from "@/constants/transfers";

interface IInsertInternalTransfer {
    trx: Kysely<Database>;
    id: string;
    senderId: string;
    recipientId: string;
    senderTag: string | null;
    recipientTag: string;
    amount: string;
    currency: string;
    note: string | null;
    idempotencyKey: string;
    ledgerTransactionId: string;
}

const insertInternalTransfer = async ({ trx, ...values }: IInsertInternalTransfer) => {
    const transferRow = await trx
        .insertInto("internal_transfers")
        .values({
            id: values.id,
            senderId: values.senderId,
            recipientId: values.recipientId,
            senderTag: values.senderTag,
            recipientTag: values.recipientTag,
            amount: values.amount,
            currency: values.currency,
            note: values.note,
            idempotencyKey: values.idempotencyKey,
            status: TRANSFER_STATUS.COMPLETED,
            ledgerTransactionId: values.ledgerTransactionId,
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return transferRow;
};

export default insertInternalTransfer;
