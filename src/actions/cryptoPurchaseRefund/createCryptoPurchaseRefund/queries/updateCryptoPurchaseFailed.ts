import { Kysely } from "kysely";
import { Database } from "@/database/types";

const updateCryptoPurchaseFailed = async ({ trx, id, failureReason, ledgerTransactionId }: { trx: Kysely<Database>; id: string; failureReason: string; ledgerTransactionId: string }) => {
    const now = new Date();
    const purchaseRow = await trx
        .updateTable("crypto_purchases")
        .set({ status: "failed", failureReason: failureReason.slice(0, 255), finalLedgerTransactionId: ledgerTransactionId, finalizedAt: now, updatedAt: now })
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return purchaseRow;
};

export default updateCryptoPurchaseFailed;
