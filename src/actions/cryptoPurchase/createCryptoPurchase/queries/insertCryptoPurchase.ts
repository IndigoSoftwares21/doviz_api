import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertCryptoPurchase {
    trx: Kysely<Database>;
    id: string;
    userId: string;
    assetId: string;
    provider: string;
    environment: string;
    providerAssetId: string;
    idempotencyKey: string;
    address: string;
    memo: string | null;
    cryptoAmount: string;
    networkFee: string;
    rateId: string;
    unitPrice: string;
    currency: string;
    nairaAmount: string;
    nairaFee: string;
    totalNaira: string;
    holdLedgerTransactionId: string;
}

const insertCryptoPurchase = async ({ trx, ...values }: IInsertCryptoPurchase) => {
    const purchaseRow = await trx
        .insertInto("crypto_purchases")
        .values({ ...values, status: "pending" })
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return purchaseRow;
};

export default insertCryptoPurchase;
