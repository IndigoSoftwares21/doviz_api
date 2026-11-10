import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertBillPayment {
    trx: Kysely<Database>;
    id: string;
    userId: string;
    productId: string;
    billerId: string;
    provider: string;
    idempotencyKey: string;
    customerId: string;
    currency: string;
    amount: string;
    serviceFee: string;
    total: string;
    holdLedgerTransactionId: string;
}

const insertBillPayment = async ({
    trx,
    id,
    userId,
    productId,
    billerId,
    provider,
    idempotencyKey,
    customerId,
    currency,
    amount,
    serviceFee,
    total,
    holdLedgerTransactionId,
}: IInsertBillPayment) => {
    const paymentRow = await trx
        .insertInto("bill_payments")
        .values({
            id,
            userId,
            productId,
            billerId,
            provider,
            idempotencyKey,
            customerId,
            currency,
            amount,
            serviceFee,
            total,
            status: "pending",
            holdLedgerTransactionId,
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return paymentRow;
};

export default insertBillPayment;
