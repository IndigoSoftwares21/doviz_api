import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertLedgerTransaction {
    trx: Kysely<Database>;
    idempotencyKey: string;
    type: string;
    description: string;
    metadata: Record<string, unknown>;
}

const insertLedgerTransaction = async ({ trx, idempotencyKey, type, description, metadata }: IInsertLedgerTransaction) => {
    const transactionRow = await trx
        .insertInto("ledger_transactions")
        .values({ idempotencyKey, type, description, metadata: JSON.stringify(metadata) })
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return transactionRow;
};

export default insertLedgerTransaction;
