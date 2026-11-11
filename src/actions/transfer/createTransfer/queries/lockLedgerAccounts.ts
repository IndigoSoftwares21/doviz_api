import { Kysely } from "kysely";
import { Database } from "@/database/types";

/**
 * Row-locks the accounts in id order — the same order createLedgerPosting
 * applies entries in — so A→B and B→A at once can't deadlock. Holding the
 * sender's lock also serialises their sends, so the daily-cap check can't be
 * slipped under by two sends at the same moment.
 */
const lockLedgerAccounts = async ({ trx, accountIds }: { trx: Kysely<Database>; accountIds: string[] }) => {
    await trx.selectFrom("ledger_accounts").select(["id"]).where("id", "in", accountIds).orderBy("id").forUpdate().execute();
};

export default lockLedgerAccounts;
