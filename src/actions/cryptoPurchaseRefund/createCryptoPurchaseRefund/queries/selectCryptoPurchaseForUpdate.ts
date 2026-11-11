import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Row lock: settle, refund and review can't race. */
const selectCryptoPurchaseForUpdate = async ({ trx, id }: { trx: Kysely<Database>; id: string }) => {
    const purchaseRow = await trx
        .selectFrom("crypto_purchases")
        .innerJoin("crypto_assets", "crypto_assets.id", "crypto_purchases.assetId")
        .select([
            "crypto_purchases.id",
            "crypto_purchases.userId",
            "crypto_purchases.provider",
            "crypto_purchases.status",
            "crypto_purchases.currency",
            "crypto_purchases.totalNaira",
            "crypto_purchases.cryptoAmount",
            "crypto_purchases.networkFee",
            "crypto_assets.symbol",
        ])
        .where("crypto_purchases.id", "=", id)
        .forUpdate("crypto_purchases")
        .executeTakeFirstOrThrow();

    return purchaseRow;
};

export default selectCryptoPurchaseForUpdate;
