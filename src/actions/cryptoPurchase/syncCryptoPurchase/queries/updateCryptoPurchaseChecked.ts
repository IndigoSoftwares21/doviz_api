import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Still open: note that we checked, and keep the provider's reference if we've just learned it. */
const updateCryptoPurchaseChecked = async ({ trx, id, providerReference }: { trx: Kysely<Database>; id: string; providerReference: string | null }) => {
    const purchaseRow = await trx
        .updateTable("crypto_purchases")
        .set((eb) => ({ providerReference: eb.fn.coalesce("providerReference", eb.val(providerReference)), updatedAt: new Date() }))
        .where("id", "=", id)
        .where("status", "in", ["pending", "processing", "needs_review"])
        .returning(["id"])
        .executeTakeFirst();

    return purchaseRow;
};

export default updateCryptoPurchaseChecked;
