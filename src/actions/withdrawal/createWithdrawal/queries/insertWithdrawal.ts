import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertWithdrawal {
    trx: Kysely<Database>;
    id: string;
    userId: string;
    bankAccountId: string;
    provider: string;
    environment: string;
    providerBankCode: string;
    idempotencyKey: string;
    currency: string;
    amount: string;
    feeReserve: string;
    totalHeld: string;
    holdLedgerTransactionId: string;
}

const insertWithdrawal = async ({
    trx,
    id,
    userId,
    bankAccountId,
    provider,
    environment,
    providerBankCode,
    idempotencyKey,
    currency,
    amount,
    feeReserve,
    totalHeld,
    holdLedgerTransactionId,
}: IInsertWithdrawal) => {
    const withdrawalRow = await trx
        .insertInto("bank_withdrawals")
        .values({
            id,
            userId,
            bankAccountId,
            provider,
            environment,
            providerBankCode,
            idempotencyKey,
            currency,
            amount,
            feeReserve,
            totalHeld,
            status: "pending",
            holdLedgerTransactionId,
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return withdrawalRow;
};

export default insertWithdrawal;
