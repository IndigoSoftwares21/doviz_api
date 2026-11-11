import { randomUUID } from "crypto";
import { db } from "@/database";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createTransfer from "@/actions/transfer/createTransfer";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";

type Limits = { minAmount: string; maxPerTransfer: string; maxPerDay: string };

/** Real-Postgres fixtures: users with Ziktags and naira, sends, balances and the limits row. */
export const createTransferHarness = () => {
    let original: Limits | undefined;
    const tag = (prefix: string) => `${prefix}${randomUUID().replace(/-/g, "").slice(0, 10)}`;

    const fund = (userId: string, amount: string) =>
        db.transaction().execute((trx) => createLedgerPosting({
            trx, idempotencyKey: `test-fund-${randomUUID()}`, type: LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT, description: "Test funding",
            entries: [
                { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId }, amount },
                { account: { kind: LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, provider: "testfund" }, amount: `-${amount}` },
            ],
        }));

    const newUser = async ({ funds = "0", status = "active", withTag = true, firstName = "Ada", lastName = "Okafor" } = {}) => {
        const user = await db.insertInto("users").values({
            phoneNumber: `+23485${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
            status, firstName, lastName, tag: withTag ? tag("t") : null,
        } as never).returning(["id", "tag"]).executeTakeFirstOrThrow();
        if (funds !== "0") await fund(user.id, funds);
        return { id: user.id, tag: user.tag as string };
    };

    const balance = async (userId: string) => {
        const row = await db.selectFrom("ledger_accounts").select(["balance"])
            .where("kind", "=", LEDGER_ACCOUNT_KIND.USER_AVAILABLE).where("userId", "=", userId).where("currency", "=", "NGN").executeTakeFirst();
        return row?.balance ?? "0";
    };

    const send = (senderId: string, recipientId: string, amount: string, { idempotencyKey = randomUUID(), note = null as string | null } = {}) =>
        createTransfer({ senderId, recipientId, amount, note, idempotencyKey, pin: "4827", ipAddress: null, userAgent: null });

    const transfersFrom = (senderId: string) =>
        db.selectFrom("internal_transfers").select(["id", "amount", "status", "note"]).where("senderId", "=", senderId).execute();

    const setLimits = (limits: Partial<Limits>) =>
        db.updateTable("transfer_limits").set(limits).where("scope", "=", "default").where("currency", "=", "NGN").execute();

    const saveLimits = async () => {
        original = await db.selectFrom("transfer_limits").select(["minAmount", "maxPerTransfer", "maxPerDay"])
            .where("scope", "=", "default").where("currency", "=", "NGN").executeTakeFirstOrThrow();
    };
    const restoreLimits = async () => {
        if (original) await setLimits(original);
    };

    return { tag, fund, newUser, balance, send, transfersFrom, setLimits, saveLimits, restoreLimits };
};
