import { db } from "@/database";

/** The provider accepted it: keep its reference. */
const updateCryptoPurchaseSubmitted = async ({ id, providerReference }: { id: string; providerReference: string | null }) => {
    const purchaseRow = await db
        .updateTable("crypto_purchases")
        .set((eb) => ({ providerReference: eb.fn.coalesce("providerReference", eb.val(providerReference)), updatedAt: new Date() }))
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirst();

    return purchaseRow;
};

export default updateCryptoPurchaseSubmitted;
