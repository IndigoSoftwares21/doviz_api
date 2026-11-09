import { db } from "@/database";
import { WALLET_STATUS } from "@/constants/cryptoStatus";

/** The user's current (pending/active) address for this asset at this provider. */
const selectCurrentWallet = async ({ userId, assetId, provider }: { userId: string; assetId: string; provider: string }) => {
    const walletRow = await db
        .selectFrom("crypto_wallets")
        .select(["id", "label", "status", "isPrimary", "address", "createdAt"])
        .where("userId", "=", userId)
        .where("assetId", "=", assetId)
        .where("provider", "=", provider)
        .where("status", "in", [WALLET_STATUS.PENDING, WALLET_STATUS.ACTIVE])
        .executeTakeFirst();

    return walletRow;
};

export default selectCurrentWallet;
