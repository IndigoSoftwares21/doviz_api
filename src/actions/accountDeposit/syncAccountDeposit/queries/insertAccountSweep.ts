import { createHash } from "crypto";
import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** A fixed sweep reference per deposit (≤36 chars, Fossapay's limit): retries reuse it, so money moves once. */
export const sweepReference = ({ provider, depositReference }: { provider: string; depositReference: string }) =>
    `sw${createHash("sha256").update(`${provider}:${depositReference}`).digest("hex").slice(0, 30)}`;

/** Queues moving a credited deposit into the pool; a deposit gets one sweep however often this runs. */
const insertAccountSweep = async ({ trx, values }: { trx: Kysely<Database>; values: { provider: string; depositReference: string; fromAccount: string; amount: string } }) => {
    const row = await trx
        .insertInto("account_sweeps")
        .values({ ...values, reference: sweepReference(values), status: "pending", attempts: 0 })
        .onConflict((oc) => oc.columns(["provider", "depositReference"]).doNothing())
        .returning(["id"])
        .executeTakeFirst();
    return row?.id ?? null;
};

export default insertAccountSweep;
