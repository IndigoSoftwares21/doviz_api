/**
 * Real-Postgres: limits, races and lookups (skipped by default).
 *   DB_INTEGRATION=true DB_PORT=<port> npx jest tests/transfers
 */
import { randomUUID } from "crypto";
import Decimal from "decimal.js";
import { db, disconnect } from "@/database";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import fetchTransferLimits from "@/actions/transferLimits/fetchTransferLimits";
import fetchTransferRecipient from "@/actions/transferRecipient/fetchTransferRecipient";
import fetchRecentRecipients from "@/actions/transferRecipients/fetchRecentRecipients";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { createTransferHarness } from "./transferHarness";

jest.mock("@/actions/pinVerification/createPinVerification");
jest.mock("@/services/realtime/publishUserEvent");

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("transfers against Postgres: limits, races, lookups", () => {
    const h = createTransferHarness();

    beforeAll(() => h.saveLimits());
    beforeEach(async () => {
        await h.restoreLimits();
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } } as never);
    });
    afterAll(async () => {
        await h.restoreLimits();
        await disconnect();
    });

    it("the daily cap counts every send in the last 24 hours, and says what's left", async () => {
        const tunde = await h.newUser({ funds: "2000000.00" });
        const ada = await h.newUser();
        await h.setLimits({ maxPerDay: "1000000", maxPerTransfer: "1000000" });
        expect((await h.send(tunde.id, ada.id, "400000")).failure).toBeNull();
        expect((await h.send(tunde.id, ada.id, "400000")).failure).toBeNull();
        await expect(h.send(tunde.id, ada.id, "300000")).resolves.toMatchObject({ failure: "transfer_limit", message: "You can send up to ₦200,000 more today" });
        expect((await fetchTransferLimits({ userId: tunde.id })).data).toMatchObject({ sentToday: "800000.00", remainingToday: "200000.00" });
        expect(await h.balance(ada.id)).toBe("800000.00");
    });

    it("two sends at the same moment can't both slip under the cap", async () => {
        const tunde = await h.newUser({ funds: "500000.00" });
        const ada = await h.newUser();
        await h.setLimits({ maxPerDay: "100000" });
        const results = await Promise.all([1, 2, 3, 4].map(() => h.send(tunde.id, ada.id, "60000")));
        expect(results.filter((result) => result.failure === null)).toHaveLength(1);
        expect(results.filter((result) => result.failure === "transfer_limit")).toHaveLength(3);
        expect(await h.balance(ada.id)).toBe("60000.00");
    });

    it("a limit changed in the database applies to the very next transfer", async () => {
        const tunde = await h.newUser({ funds: "10000.00" });
        const ada = await h.newUser();
        await h.setLimits({ maxPerTransfer: "1000" });
        await expect(h.send(tunde.id, ada.id, "2000")).resolves.toMatchObject({ failure: "transfer_limit", message: "You can send up to ₦1,000 per transfer" });
        await h.restoreLimits();
        expect((await h.send(tunde.id, ada.id, "2000")).failure).toBeNull();
    });

    it("A→B and B→A at the same moment all succeed (no deadlock) and balance out", async () => {
        const a = await h.newUser({ funds: "100000.00" });
        const b = await h.newUser({ funds: "100000.00" });
        const sends = Array.from({ length: 16 }, (_, i) => (i % 2 ? h.send(a.id, b.id, "1000") : h.send(b.id, a.id, "1000")));
        const results = await Promise.all(sends);
        expect(results.every((result) => result.failure === null)).toBe(true);
        expect([await h.balance(a.id), await h.balance(b.id)]).toEqual(["100000.00", "100000.00"]);
    });

    it("createLedgerPosting itself applies entries in a fixed order: opposite listings don't deadlock", async () => {
        const a = await h.newUser({ funds: "50000.00" });
        const b = await h.newUser({ funds: "50000.00" });
        const leg = (userId: string, amount: string) => ({ account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId }, amount });
        const post = (entries: ReturnType<typeof leg>[]) => db.transaction().execute((trx) => createLedgerPosting({
            trx, idempotencyKey: `test-order-${randomUUID()}`, type: LEDGER_TRANSACTION_TYPE.INTERNAL_TRANSFER, description: "Order test", entries,
        }));
        // Listed debit-first both ways: without the fix, each locks its own debit account first.
        const postings = Array.from({ length: 16 }, (_, i) => (i % 2 ? post([leg(a.id, "-100"), leg(b.id, "100")]) : post([leg(b.id, "-100"), leg(a.id, "100")])));
        await expect(Promise.all(postings)).resolves.toHaveLength(16);
        expect(new Decimal(await h.balance(a.id)).plus(await h.balance(b.id)).toFixed(2)).toBe("100000.00");
    });

    it("lookup: exact tag only; never yourself, the suspended or the nameless", async () => {
        const me = await h.newUser();
        const ada = await h.newUser();
        const suspended = await h.newUser({ status: "suspended" });
        expect((await fetchTransferRecipient({ tag: ada.tag, viewerId: me.id })).data).toEqual({ recipientId: ada.id, tag: ada.tag, displayName: "Ada O.", initials: "AO" });
        for (const tag of [me.tag, suspended.tag, ada.tag.slice(0, -1), "nobody_here"]) {
            expect((await fetchTransferRecipient({ tag, viewerId: me.id })).data).toBeNull();
        }
    });

    it("recent recipients: distinct, newest first, current tag, payable only", async () => {
        const me = await h.newUser({ funds: "10000.00" });
        const [first, second, later] = [await h.newUser(), await h.newUser(), await h.newUser()];
        for (const to of [first, second, first]) await h.send(me.id, to.id, "100");
        await h.send(me.id, later.id, "100");
        await db.updateTable("users").set({ status: "suspended" }).where("id", "=", later.id).execute();
        await db.updateTable("users").set({ tag: h.tag("n") }).where("id", "=", second.id).execute();
        const { data } = await fetchRecentRecipients({ userId: me.id });
        expect(data.recipients.map((r) => r.recipientId)).toEqual([first.id, second.id]);
        expect(data.recipients[1].tag).not.toBe(second.tag);
    });
});
