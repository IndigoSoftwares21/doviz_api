import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertLedgerEntry {
    trx: Kysely<Database>;
    transactionId: string;
    accountId: string;
    currency: string;
    amount: string;
}

/** The posting trigger moves the account balance and stamps balance_after. */
const insertLedgerEntry = async ({ trx, transactionId, accountId, currency, amount }: IInsertLedgerEntry) => {
    const entryRow = await trx
        .insertInto("ledger_entries")
        .values({ transactionId, accountId, currency, amount, balanceAfter: "0" })
        .returning(["id", "balanceAfter"])
        .executeTakeFirstOrThrow();

    return entryRow;
};

export default insertLedgerEntry;
