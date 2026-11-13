import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { FeeBearer } from "@/constants/nairaDeposits";

/**
 * A payment into an account number, as a naira deposit (so history, receipts
 * and pushes work as for any deposit). UNIQUE (provider, provider_reference)
 * means a payment is recorded once however many webhooks arrive; returns the
 * existing row's id when it's already there.
 */
const insertAccountDeposit = async ({
    trx,
    values,
}: {
    trx: Kysely<Database>;
    values: { userId: string; provider: string; reference: string; amount: string; currency: string; feeBearer: FeeBearer; accountNumber: string; accountName: string; bankName: string };
}) => {
    const inserted = await trx
        .insertInto("naira_deposits")
        .values({
            userId: values.userId,
            provider: values.provider,
            providerReference: values.reference,
            idempotencyKey: `account:${values.reference}`.slice(0, 64),
            currency: values.currency,
            amount: values.amount,
            feeBearer: values.feeBearer,
            accountNumber: values.accountNumber,
            accountName: values.accountName,
            bankName: values.bankName,
            status: "pending",
        })
        .onConflict((oc) => oc.columns(["provider", "providerReference"]).doNothing())
        .returning(["id"])
        .executeTakeFirst();
    if (inserted) return inserted.id;
    const existing = await trx
        .selectFrom("naira_deposits")
        .select(["id"])
        .where("provider", "=", values.provider)
        .where("providerReference", "=", values.reference)
        .executeTakeFirstOrThrow();
    return existing.id;
};

export default insertAccountDeposit;
