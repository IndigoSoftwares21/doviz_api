import Decimal from "decimal.js";
import { Kysely } from "kysely";
import { Database } from "@/database/types";
import CRYPTO from "@/constants/crypto";
import ensureLedgerAccount, { LedgerAccountRef } from "./queries/ensureLedgerAccount";
import insertLedgerTransaction from "./queries/insertLedgerTransaction";
import insertLedgerEntry from "./queries/insertLedgerEntry";
import { LedgerTransactionType } from "@/constants/ledger";

export type { LedgerTransactionType };

interface ICreateLedgerPosting {
    /** Must be the caller's transaction: the posting commits with the business change. */
    trx: Kysely<Database>;
    idempotencyKey: string;
    type: LedgerTransactionType;
    description: string;
    metadata?: Record<string, unknown>;
    /** Every entry's currency. Defaults to naira, the only user balance today. */
    currency?: string;
    entries: { account: LedgerAccountRef; amount: string }[];
}

/**
 * The ONLY way money moves. Entries are signed naira strings that must sum to
 * zero; the database enforces the same (plus no overdrafts, append-only,
 * idempotency) at COMMIT — this check just fails fast with a clear error.
 */
const createLedgerPosting = async ({
    trx,
    idempotencyKey,
    type,
    description,
    metadata = {},
    currency = CRYPTO.CURRENCY,
    entries,
}: ICreateLedgerPosting) => {
    const total = entries.reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0));
    if (entries.length < 2 || !total.isZero()) {
        throw new Error(`Ledger posting ${idempotencyKey} must have >= 2 entries summing to zero`);
    }

    const transaction = await insertLedgerTransaction({ trx, idempotencyKey, type, description, metadata });

    for (const entry of entries) {
        const account = await ensureLedgerAccount({ trx, account: entry.account, currency });
        await insertLedgerEntry({
            trx,
            transactionId: transaction.id,
            accountId: account.id,
            currency,
            amount: entry.amount,
        });
    }

    return { data: { transactionId: transaction.id } };
};

export default createLedgerPosting;
