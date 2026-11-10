import { db } from "@/database";

const selectWithdrawalForSync = async ({ id }: { id: string }) => {
    const withdrawalRow = await db
        .selectFrom("bank_withdrawals")
        .select(["id", "provider", "status", "providerReference", "requestedAt"])
        .where("id", "=", id)
        .executeTakeFirst();

    return withdrawalRow;
};

export default selectWithdrawalForSync;
