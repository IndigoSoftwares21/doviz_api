import { db } from "@/database";
import { WALLET_STATUS } from "@/constants/cryptoStatus";

interface IInsertPendingWallet {
    id: string;
    userId: string;
    assetId: string;
    provider: string;
    label: string;
}

/** Recorded BEFORE calling the provider. A concurrent duplicate is a no-op (unique index). */
const insertPendingWallet = async ({ id, userId, assetId, provider, label }: IInsertPendingWallet) => {
    const walletRow = await db
        .insertInto("crypto_wallets")
        .values({ id, userId, assetId, provider, label, status: WALLET_STATUS.PENDING, isPrimary: false })
        .onConflict((oc) => oc.doNothing())
        .returning(["id"])
        .executeTakeFirst();

    return walletRow;
};

export default insertPendingWallet;
