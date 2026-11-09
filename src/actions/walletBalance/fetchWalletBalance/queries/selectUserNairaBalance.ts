import { db } from "@/database";
import { LEDGER_ACCOUNT_KIND } from "@/constants/ledger";

const selectUserNairaBalance = async ({ userId, currency }: { userId: string; currency: string }) => {
    const accountRow = await db
        .selectFrom("ledger_accounts")
        .select(["balance"])
        .where("kind", "=", LEDGER_ACCOUNT_KIND.USER_AVAILABLE)
        .where("userId", "=", userId)
        .where("currency", "=", currency)
        .executeTakeFirst();

    return accountRow;
};

export default selectUserNairaBalance;
