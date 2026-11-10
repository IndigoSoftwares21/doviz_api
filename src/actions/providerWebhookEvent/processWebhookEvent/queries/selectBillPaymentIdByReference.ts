import { db } from "@/database";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A provider's bill payment by our id (when it echoes it back) or by its own reference. */
const selectBillPaymentIdByReference = async ({ provider, reference }: { provider: string; reference: string }) => {
    const paymentRow = await db
        .selectFrom("bill_payments")
        .select(["id"])
        .where("provider", "=", provider)
        .where((eb) =>
            UUID.test(reference) ? eb.or([eb("id", "=", reference), eb("providerReference", "=", reference)]) : eb("providerReference", "=", reference),
        )
        .executeTakeFirst();

    return paymentRow;
};

export default selectBillPaymentIdByReference;
