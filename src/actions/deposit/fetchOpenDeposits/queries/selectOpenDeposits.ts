import { db } from "@/database";
import { DEPOSIT_STATUS } from "@/constants/cryptoStatus";

const selectOpenDeposits = async ({ limit }: { limit: number }) => {
    const depositRows = await db
        .selectFrom("crypto_deposits")
        .select(["provider", "providerReference"])
        .where("status", "in", [DEPOSIT_STATUS.PENDING, DEPOSIT_STATUS.FLAGGED])
        .orderBy("detectedAt", "asc")
        .limit(limit)
        .execute();

    return depositRows;
};

export default selectOpenDeposits;
