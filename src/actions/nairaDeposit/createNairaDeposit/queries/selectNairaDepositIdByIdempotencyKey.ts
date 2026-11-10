import { db } from "@/database";

const selectNairaDepositIdByIdempotencyKey = async ({ userId, idempotencyKey }: { userId: string; idempotencyKey: string }) => {
    const depositRow = await db
        .selectFrom("naira_deposits")
        .select(["id"])
        .where("userId", "=", userId)
        .where("idempotencyKey", "=", idempotencyKey)
        .executeTakeFirst();

    return depositRow;
};

export default selectNairaDepositIdByIdempotencyKey;
