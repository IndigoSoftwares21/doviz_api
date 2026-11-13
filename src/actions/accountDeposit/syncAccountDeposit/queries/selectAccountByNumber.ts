import { db } from "@/database";

/** Which user owns an account number at this provider (open or closed: money paid in is theirs either way). */
const selectAccountByNumber = async ({ provider, accountNumber }: { provider: string; accountNumber: string }) => {
    const accountRow = await db
        .selectFrom("virtual_accounts")
        .select(["userId", "accountNumber", "accountName", "bankName"])
        .where("provider", "=", provider)
        .where("accountNumber", "=", accountNumber)
        .executeTakeFirst();

    return accountRow ?? null;
};

export default selectAccountByNumber;
