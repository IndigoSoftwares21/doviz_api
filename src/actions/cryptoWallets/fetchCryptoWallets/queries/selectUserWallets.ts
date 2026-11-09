import { db } from "@/database";
import { WALLET_STATUS } from "@/constants/cryptoStatus";

/** Addresses the user can see: active and retired (pending/failed have none yet). */
const selectUserWallets = async ({ userId }: { userId: string }) => {
    const walletRows = await db
        .selectFrom("crypto_wallets")
        .innerJoin("crypto_assets", "crypto_assets.id", "crypto_wallets.assetId")
        .select([
            "crypto_wallets.id",
            "crypto_wallets.assetId",
            "crypto_assets.symbol",
            "crypto_assets.network",
            "crypto_wallets.address",
            "crypto_wallets.status",
            "crypto_wallets.isPrimary",
            "crypto_wallets.createdAt",
            "crypto_wallets.retiredAt",
        ])
        .where("crypto_wallets.userId", "=", userId)
        .where("crypto_wallets.status", "in", [WALLET_STATUS.ACTIVE, WALLET_STATUS.RETIRED])
        .orderBy("crypto_wallets.isPrimary", "desc")
        .orderBy("crypto_wallets.createdAt", "desc")
        .execute();

    return walletRows;
};

export default selectUserWallets;
