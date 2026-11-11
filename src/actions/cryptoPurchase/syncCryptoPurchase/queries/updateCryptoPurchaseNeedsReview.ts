import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Only an open (pending/processing) purchase moves to review; returns undefined if it already had. */
const updateCryptoPurchaseNeedsReview = async ({ trx, id }: { trx: Kysely<Database>; id: string }) => {
    const purchaseRow = await trx
        .updateTable("crypto_purchases")
        .set({ status: "needs_review", updatedAt: new Date() })
        .where("id", "=", id)
        .where("status", "in", ["pending", "processing"])
        .returning(["id", "userId"])
        .executeTakeFirst();

    return purchaseRow;
};

export default updateCryptoPurchaseNeedsReview;
