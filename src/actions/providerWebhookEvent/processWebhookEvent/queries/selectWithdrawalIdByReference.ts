import { db } from "@/database";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A provider's payout by our withdrawal id (sent as its reference) or its own reference. */
const selectWithdrawalIdByReference = async ({ provider, reference }: { provider: string; reference: string }) => {
    const withdrawalRow = await db
        .selectFrom("bank_withdrawals")
        .select(["id"])
        .where("provider", "=", provider)
        .where((eb) =>
            UUID.test(reference) ? eb.or([eb("id", "=", reference), eb("providerReference", "=", reference)]) : eb("providerReference", "=", reference),
        )
        .executeTakeFirst();

    return withdrawalRow;
};

export default selectWithdrawalIdByReference;
