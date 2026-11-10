import { db } from "@/database";

const selectWithdrawalIdByIdempotencyKey = async ({ userId, idempotencyKey }: { userId: string; idempotencyKey: string }) => {
    const withdrawalRow = await db
        .selectFrom("bank_withdrawals")
        .select(["id"])
        .where("userId", "=", userId)
        .where("idempotencyKey", "=", idempotencyKey)
        .executeTakeFirst();

    return withdrawalRow;
};

export default selectWithdrawalIdByIdempotencyKey;
