import { db } from "@/database";

const selectNairaDepositForSync = async ({ id }: { id: string }) => {
    const depositRow = await db
        .selectFrom("naira_deposits")
        .select(["id", "userId", "provider", "status", "providerReference", "expiresAt"])
        .where("id", "=", id)
        .executeTakeFirst();

    return depositRow;
};

export default selectNairaDepositForSync;
