/**
 * Real-Postgres check of the bill ledger vocabulary (skipped by default).
 * Run against a DISPOSABLE, fully migrated database — ledger rows can't be
 * deleted, so never point this at a shared database:
 *   DB_INTEGRATION=true DB_PORT=<port> npx jest tests/bills/billLedger.integration.test.ts
 */
import { randomUUID } from "crypto";
import { db, disconnect } from "@/database";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("bill ledger postings against Postgres", () => {
    const provider = `fakebills${randomUUID().slice(0, 6)}`;
    let userId: string;

    const balanceOf = async (kind: string, owner: { userId?: string; provider?: string }) => {
        const row = await db
            .selectFrom("ledger_accounts")
            .select(["balance"])
            .where("kind", "=", kind)
            .where("currency", "=", "NGN")
            .where("userId", owner.userId ? "=" : "is", owner.userId ?? null)
            .where("provider", owner.provider ? "=" : "is", owner.provider ?? null)
            .executeTakeFirst();
        return row ? Number(row.balance) : 0;
    };

    beforeAll(async () => {
        const user = await db
            .insertInto("users")
            .values({ phoneNumber: `+23481${Date.now().toString().slice(-8)}`, status: "active" } as never)
            .returning(["id"])
            .executeTakeFirstOrThrow();
        userId = user.id;

        // Give the user ₦10,000 to spend.
        await db.transaction().execute((trx) =>
            createLedgerPosting({
                trx,
                idempotencyKey: `test-fund-${userId}`,
                type: LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT,
                description: "Test funding",
                entries: [
                    { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId }, amount: "10000.00" },
                    { account: { kind: LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, provider: "testfund" }, amount: "-10000.00" },
                ],
            }),
        );
    });

    afterAll(async () => {
        await disconnect();
    });

    it("holds, settles with a margin, and refunds", async () => {
        const hold = (key: string, amount: string) =>
            db.transaction().execute((trx) =>
                createLedgerPosting({
                    trx,
                    idempotencyKey: key,
                    type: LEDGER_TRANSACTION_TYPE.BILL_HOLD,
                    description: "Bill payment",
                    currency: "NGN",
                    entries: [
                        { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId }, amount: `-${amount}` },
                        { account: { kind: LEDGER_ACCOUNT_KIND.BILLS_IN_TRANSIT, provider }, amount },
                    ],
                }),
            );

        // Paid bill: ₦2,050 held, provider charged ₦1,980 → ₦70 margin.
        await hold(`test-bill-hold-a-${userId}`, "2050.00");
        await db.transaction().execute((trx) =>
            createLedgerPosting({
                trx,
                idempotencyKey: `test-bill-settle-a-${userId}`,
                type: LEDGER_TRANSACTION_TYPE.BILL_SETTLE,
                description: "Bill payment settled",
                entries: [
                    { account: { kind: LEDGER_ACCOUNT_KIND.BILLS_IN_TRANSIT, provider }, amount: "-2050.00" },
                    { account: { kind: LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, provider }, amount: "1980.00" },
                    { account: { kind: LEDGER_ACCOUNT_KIND.BILL_REVENUE }, amount: "70.00" },
                ],
            }),
        );

        // Failed bill: ₦1,000 held, then refunded in full.
        await hold(`test-bill-hold-b-${userId}`, "1000.00");
        await db.transaction().execute((trx) =>
            createLedgerPosting({
                trx,
                idempotencyKey: `test-bill-reversal-b-${userId}`,
                type: LEDGER_TRANSACTION_TYPE.BILL_REVERSAL,
                description: "Bill payment refunded",
                entries: [
                    { account: { kind: LEDGER_ACCOUNT_KIND.BILLS_IN_TRANSIT, provider }, amount: "-1000.00" },
                    { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId }, amount: "1000.00" },
                ],
            }),
        );

        expect(await balanceOf(LEDGER_ACCOUNT_KIND.USER_AVAILABLE, { userId })).toBe(7950);
        expect(await balanceOf(LEDGER_ACCOUNT_KIND.BILLS_IN_TRANSIT, { provider })).toBe(0);
        expect(await balanceOf(LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, { provider })).toBe(1980);
    });

    it("rejects a bill hold larger than the user's balance", async () => {
        await expect(
            db.transaction().execute((trx) =>
                createLedgerPosting({
                    trx,
                    idempotencyKey: `test-bill-hold-overdraft-${userId}`,
                    type: LEDGER_TRANSACTION_TYPE.BILL_HOLD,
                    description: "Bill payment",
                    entries: [
                        { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId }, amount: "-1000000.00" },
                        { account: { kind: LEDGER_ACCOUNT_KIND.BILLS_IN_TRANSIT, provider }, amount: "1000000.00" },
                    ],
                }),
            ),
        ).rejects.toThrow(/ledger_accounts_user_non_negative/);
    });
});
