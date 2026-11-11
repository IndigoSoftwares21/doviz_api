import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateCryptoPurchaseCompleted {
    trx: Kysely<Database>;
    id: string;
    ledgerTransactionId: string;
    providerReference: string | null;
    providerFeeCharged: string | null;
    txHash: string | null;
}

const updateCryptoPurchaseCompleted = async ({ trx, id, ledgerTransactionId, providerReference, providerFeeCharged, txHash }: IUpdateCryptoPurchaseCompleted) => {
    const now = new Date();
    const purchaseRow = await trx
        .updateTable("crypto_purchases")
        .set((eb) => ({
            status: "completed",
            finalLedgerTransactionId: ledgerTransactionId,
            providerReference: eb.fn.coalesce("providerReference", eb.val(providerReference)),
            providerFeeCharged,
            txHash,
            finalizedAt: now,
            updatedAt: now,
        }))
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return purchaseRow;
};

export default updateCryptoPurchaseCompleted;
