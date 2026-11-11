import { db } from "@/database";

/** Outcome unknown (timeout / unclear error): the checks and the reconciler decide. */
const updateCryptoPurchaseProcessing = async ({ id }: { id: string }) => {
    const purchaseRow = await db
        .updateTable("crypto_purchases")
        .set({ status: "processing", updatedAt: new Date() })
        .where("id", "=", id)
        .where("status", "=", "pending")
        .returning(["id"])
        .executeTakeFirst();

    return purchaseRow;
};

export default updateCryptoPurchaseProcessing;
