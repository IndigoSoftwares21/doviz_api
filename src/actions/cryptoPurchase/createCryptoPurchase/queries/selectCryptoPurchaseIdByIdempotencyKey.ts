import { db } from "@/database";

const selectCryptoPurchaseIdByIdempotencyKey = async ({ userId, idempotencyKey }: { userId: string; idempotencyKey: string }) => {
    const purchaseRow = await db
        .selectFrom("crypto_purchases")
        .select(["id"])
        .where("userId", "=", userId)
        .where("idempotencyKey", "=", idempotencyKey)
        .executeTakeFirst();

    return purchaseRow;
};

export default selectCryptoPurchaseIdByIdempotencyKey;
