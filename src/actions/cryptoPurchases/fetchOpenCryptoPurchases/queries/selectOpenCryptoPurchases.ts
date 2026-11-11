import { db } from "@/database";

/**
 * Purchases still waiting on their provider (pending / processing / in
 * review) requested before `requestedBefore`, least recently checked first.
 * Review stays in the loop so a late answer from the provider resolves it.
 */
const selectOpenCryptoPurchases = async ({ requestedBefore, limit }: { requestedBefore: Date; limit: number }) => {
    const purchaseRows = await db
        .selectFrom("crypto_purchases")
        .select(["id", "provider"])
        .where("status", "in", ["pending", "processing", "needs_review"])
        .where("requestedAt", "<", requestedBefore)
        .orderBy("updatedAt")
        .limit(limit)
        .execute();

    return purchaseRows;
};

export default selectOpenCryptoPurchases;
