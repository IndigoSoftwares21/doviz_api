import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Clears the primary flag on the user's other addresses for this asset. */
const updateUnsetPrimaryWallets = async ({
    trx,
    userId,
    assetId,
    exceptId,
}: {
    trx: Kysely<Database>;
    userId: string;
    assetId: string;
    exceptId: string;
}) => {
    const walletRows = await trx
        .updateTable("crypto_wallets")
        .set({ isPrimary: false, updatedAt: new Date() })
        .where("userId", "=", userId)
        .where("assetId", "=", assetId)
        .where("isPrimary", "=", true)
        .where("id", "<>", exceptId)
        .returning(["id"])
        .execute();

    return walletRows;
};

export default updateUnsetPrimaryWallets;
