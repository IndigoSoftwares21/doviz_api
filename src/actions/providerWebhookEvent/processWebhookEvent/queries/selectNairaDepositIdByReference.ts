import { db } from "@/database";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A provider's naira deposit by our id (the reference we sent) or by its own reference. */
const selectNairaDepositIdByReference = async ({ provider, reference }: { provider: string; reference: string }) => {
    const depositRow = await db
        .selectFrom("naira_deposits")
        .select(["id"])
        .where("provider", "=", provider)
        .where((eb) =>
            UUID.test(reference) ? eb.or([eb("id", "=", reference), eb("providerReference", "=", reference)]) : eb("providerReference", "=", reference),
        )
        .executeTakeFirst();

    return depositRow;
};

export default selectNairaDepositIdByReference;
