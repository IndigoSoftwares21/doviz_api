import { db } from "@/database";

/** The user's open account number (any provider), newest first. */
const selectActiveVirtualAccount = async ({ userId }: { userId: string }) => {
    const accountRow = await db
        .selectFrom("virtual_accounts")
        .select(["accountNumber", "accountName", "bankName"])
        .where("userId", "=", userId)
        .where("status", "=", "active")
        .orderBy("createdAt", "desc")
        .executeTakeFirst();

    return accountRow ?? null;
};

export default selectActiveVirtualAccount;
