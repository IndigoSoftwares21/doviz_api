import { db } from "@/database";
import { LEDGER_ACCOUNT_KIND } from "@/constants/ledger";

/** The entry only if it's on THIS user's naira account (no IDOR). */
const selectUserStatementEntry = async ({ userId, entryId }: { userId: string; entryId: string }) => {
    const entryRow = await db
        .selectFrom("ledger_entries")
        .innerJoin("ledger_accounts", "ledger_accounts.id", "ledger_entries.accountId")
        .select(["ledger_entries.id"])
        .where("ledger_entries.id", "=", entryId)
        .where("ledger_accounts.kind", "=", LEDGER_ACCOUNT_KIND.USER_AVAILABLE)
        .where("ledger_accounts.userId", "=", userId)
        .executeTakeFirst();

    return entryRow;
};

export default selectUserStatementEntry;
