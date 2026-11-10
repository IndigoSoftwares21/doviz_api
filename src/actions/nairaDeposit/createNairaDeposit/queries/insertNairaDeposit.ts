import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertNairaDeposit {
    trx: Kysely<Database>;
    id: string;
    userId: string;
    provider: string;
    providerReference: string;
    idempotencyKey: string;
    currency: string;
    amount: string;
    feeBearer: string;
    fee: string;
    amountToTransfer: string;
    accountName: string;
    accountNumber: string;
    bankName: string;
    expiresAt: Date;
}

const insertNairaDeposit = async ({
    trx,
    id,
    userId,
    provider,
    providerReference,
    idempotencyKey,
    currency,
    amount,
    feeBearer,
    fee,
    amountToTransfer,
    accountName,
    accountNumber,
    bankName,
    expiresAt,
}: IInsertNairaDeposit) => {
    const depositRow = await trx
        .insertInto("naira_deposits")
        .values({
            id,
            userId,
            provider,
            providerReference,
            idempotencyKey,
            currency,
            amount,
            feeBearer,
            fee,
            amountToTransfer,
            accountName: accountName.slice(0, 150),
            accountNumber,
            bankName: bankName.slice(0, 100),
            expiresAt,
            status: "pending",
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return depositRow;
};

export default insertNairaDeposit;
