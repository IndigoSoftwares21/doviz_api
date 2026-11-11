import { db } from "@/database";

const selectCryptoPurchaseForSync = async ({ id }: { id: string }) => {
    const purchaseRow = await db
        .selectFrom("crypto_purchases")
        .select(["id", "userId", "provider", "providerAssetId", "status", "providerReference", "requestedAt"])
        .where("id", "=", id)
        .executeTakeFirst();

    return purchaseRow;
};

export default selectCryptoPurchaseForSync;
