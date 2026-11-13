import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertWithdrawal {
    trx: Kysely<Database>;
    id: string;
    userId: string;
    /** Exactly one: the user's saved account, or the recipient as their bank named them. */
    destination: { bankAccountId: string } | { recipientPayoutBankId: string; recipientAccountNumber: string; recipientAccountName: string };
    narration: string;
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
    destination,
    narration,
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
            ...destination,
            narration,
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
