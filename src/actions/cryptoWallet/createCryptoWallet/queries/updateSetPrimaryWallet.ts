import { Kysely } from "kysely";
import { Database } from "@/database/types";

const updateSetPrimaryWallet = async ({ trx, id }: { trx: Kysely<Database>; id: string }) => {
    const walletRow = await trx
        .updateTable("crypto_wallets")
        .set({ isPrimary: true, updatedAt: new Date() })
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return walletRow;
};

export default updateSetPrimaryWallet;
