import { db } from "@/database";

/**
 * Deposits that may still be paid: pending ones made before `createdBefore`,
 * and expired ones whose account lapsed after `expiredAfter` (late payments).
 * Least recently checked first.
 */
const selectOpenNairaDeposits = async ({ createdBefore, expiredAfter, limit }: { createdBefore: Date; expiredAfter: Date; limit: number }) => {
    const depositRows = await db
        .selectFrom("naira_deposits")
        .select(["id", "provider"])
        .where((eb) =>
            eb.or([
                eb.and([eb("status", "=", "pending"), eb("createdAt", "<", createdBefore)]),
                eb.and([eb("status", "=", "expired"), eb("expiresAt", ">", expiredAfter)]),
            ]),
        )
        .orderBy("updatedAt")
        .limit(limit)
        .execute();

    return depositRows;
};

export default selectOpenNairaDeposits;
