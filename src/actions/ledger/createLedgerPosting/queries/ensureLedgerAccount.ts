import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { LEDGER_ACCOUNT_KIND } from "@/constants/ledger";

export type LedgerAccountRef =
    | { kind: typeof LEDGER_ACCOUNT_KIND.USER_AVAILABLE; userId: string }
    | { kind: typeof LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING | typeof LEDGER_ACCOUNT_KIND.PAYOUTS_IN_TRANSIT; provider: string }
    | { kind: typeof LEDGER_ACCOUNT_KIND.MARKUP_REVENUE };

/** Finds the account, creating it on first use (race-safe via ON CONFLICT). */
const ensureLedgerAccount = async ({
    trx,
    account,
    currency,
}: {
    trx: Kysely<Database>;
    account: LedgerAccountRef;
    currency: string;
}) => {
    const userId = "userId" in account ? account.userId : null;
    const provider = "provider" in account ? account.provider : null;

    const find = () =>
        trx
            .selectFrom("ledger_accounts")
            .select(["id"])
            .where("kind", "=", account.kind)
            .where("currency", "=", currency)
            .where("userId", userId === null ? "is" : "=", userId)
            .where("provider", provider === null ? "is" : "=", provider)
            .executeTakeFirst();

    const existing = await find();
    if (existing) return existing;

    await trx
        .insertInto("ledger_accounts")
        .values({ kind: account.kind, userId, provider, currency, balance: "0" })
        .onConflict((oc) => oc.doNothing())
        .execute();

    const accountRow = await find();
    if (!accountRow) throw new Error(`Ledger account ${account.kind} could not be created`);
    return accountRow;
};

export default ensureLedgerAccount;
