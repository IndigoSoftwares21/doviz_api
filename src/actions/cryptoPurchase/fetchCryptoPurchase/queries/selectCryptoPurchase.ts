import { db } from "@/database";

/** One of the user's own purchases (never anyone else's). */
const selectCryptoPurchase = async ({ id, userId }: { id: string; userId: string }) => {
    const purchaseRow = await db
        .selectFrom("crypto_purchases")
        .innerJoin("crypto_assets", "crypto_assets.id", "crypto_purchases.assetId")
        .select([
            "crypto_purchases.id",
            "crypto_purchases.status",
            "crypto_assets.id as assetId",
            "crypto_assets.symbol",
            "crypto_assets.network",
            "crypto_assets.name as assetName",
            "crypto_purchases.address",
            "crypto_purchases.memo",
            "crypto_purchases.cryptoAmount",
            "crypto_purchases.networkFee",
            "crypto_purchases.unitPrice",
            "crypto_purchases.currency",
            "crypto_purchases.nairaAmount",
            "crypto_purchases.nairaFee",
            "crypto_purchases.totalNaira",
            "crypto_purchases.txHash",
            "crypto_purchases.failureReason",
            "crypto_purchases.requestedAt",
            "crypto_purchases.finalizedAt",
        ])
        .where("crypto_purchases.id", "=", id)
        .where("crypto_purchases.userId", "=", userId)
        .executeTakeFirst();

    return purchaseRow;
};

export type CryptoPurchaseRow = NonNullable<Awaited<ReturnType<typeof selectCryptoPurchase>>>;

export default selectCryptoPurchase;
