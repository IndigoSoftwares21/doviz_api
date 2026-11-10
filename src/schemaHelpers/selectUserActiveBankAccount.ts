import { db } from "@/database";

/** One of the user's own active (name-matched) bank accounts. */
const selectUserActiveBankAccount = async ({ bankAccountId, userId }: { bankAccountId: string; userId: string }) => {
    const accountRow = await db
        .selectFrom("user_bank_accounts")
        .select(["id"])
        .where("id", "=", bankAccountId)
        .where("userId", "=", userId)
        .where("status", "=", "active")
        .executeTakeFirst();

    return accountRow;
};

export default selectUserActiveBankAccount;
