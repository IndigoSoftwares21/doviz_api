import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** The coin that left our stock at the provider for this purchase (negative quantity). */
const insertCryptoSendMovement = async ({ trx, provider, symbol, quantity, purchaseId }: { trx: Kysely<Database>; provider: string; symbol: string; quantity: string; purchaseId: string }) => {
    const movementRow = await trx
        .insertInto("crypto_stock_movements")
        .values({ provider, symbol, kind: "send", quantity, purchaseId, recordedBy: "system" })
        .onConflict((oc) => oc.column("purchaseId").doNothing())
        .returning(["id"])
        .executeTakeFirst();

    return movementRow;
};

export default insertCryptoSendMovement;
