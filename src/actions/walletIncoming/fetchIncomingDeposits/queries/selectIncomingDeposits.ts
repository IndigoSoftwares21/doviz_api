import { db } from "@/database";
import { DEPOSIT_STATUS } from "@/constants/cryptoStatus";

const selectIncomingDeposits = async ({ userId }: { userId: string }) => {
    const depositRows = await db
        .selectFrom("crypto_deposits")
        .innerJoin("crypto_assets", "crypto_assets.id", "crypto_deposits.assetId")
        .select([
            "crypto_deposits.id",
            "crypto_deposits.status",
            "crypto_deposits.subStatus",
            "crypto_assets.symbol",
            "crypto_assets.network",
            "crypto_deposits.cryptoAmount",
            "crypto_deposits.confirmations",
            "crypto_deposits.txHash",
            "crypto_deposits.detectedAt",
        ])
        .where("crypto_deposits.userId", "=", userId)
        .where("crypto_deposits.status", "in", [DEPOSIT_STATUS.PENDING, DEPOSIT_STATUS.FLAGGED])
        .orderBy("crypto_deposits.detectedAt", "desc")
        .limit(50)
        .execute();

    return depositRows;
};

export default selectIncomingDeposits;
