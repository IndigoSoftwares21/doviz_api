/**
 * Real-Postgres checks of Ziks-to-Ziks transfers (skipped by default). Run
 * against a DISPOSABLE, fully migrated database (money rows can't be deleted):
 *   DB_INTEGRATION=true DB_PORT=<port> npx jest tests/transfers
 */
import { randomUUID } from "crypto";
import { db, disconnect } from "@/database";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import fetchWalletTransactions from "@/actions/walletTransactions/fetchWalletTransactions";
import fetchTransfer from "@/actions/transfer/fetchTransfer";
import { createTransferHarness } from "./transferHarness";

jest.mock("@/actions/pinVerification/createPinVerification");
jest.mock("@/services/realtime/publishUserEvent");

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;
const NO_FILTERS = { direction: null, type: null, from: null, to: null };

run("transfers against Postgres: money", () => {
    const h = createTransferHarness();

    beforeAll(() => h.saveLimits());
    beforeEach(() => {
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } } as never);
        jest.mocked(publishUserEvent).mockReset().mockResolvedValue(undefined);
    });
    afterAll(async () => {
        await h.restoreLimits();
        await disconnect();
    });

    it("moves exactly the amount, records it, audits both sides, and pushes to both", async () => {
        const tunde = await h.newUser({ funds: "20000.00", firstName: "Tunde", lastName: "Bello" });
        const ada = await h.newUser();
        const result = await h.send(tunde.id, ada.id, "5000.50", { note: "for lunch" });

        expect(result).toMatchObject({ isNew: true, failure: null, data: { amount: "5000.50", status: "completed", direction: "sent", note: "for lunch",
            counterparty: { tag: ada.tag, displayName: "Ada O.", initials: "AO" } } });
        expect([await h.balance(tunde.id), await h.balance(ada.id)]).toEqual(["14999.50", "5000.50"]);

        const id = result.data!.id;
        const audits = await db.selectFrom("audit_logs").select(["action"]).where("entityId", "=", id).execute();
        expect(audits.map((row) => row.action).sort()).toEqual(["wallet.transfer.received", "wallet.transfer.sent"]);
        const pushes = jest.mocked(publishUserEvent).mock.calls.map(([call]) => [call.userId, call.event, call.data ?? {}]);
        expect(pushes).toEqual(expect.arrayContaining([
            [tunde.id, "wallet.balance_changed", {}], [ada.id, "wallet.balance_changed", {}],
            [ada.id, "transfer.received", { transferId: id, amount: "5000.50", senderTag: tunde.tag }],
        ]));

        const [sent] = (await fetchWalletTransactions({ userId: tunde.id, afterEntryId: null, size: 1, filters: NO_FILTERS })).data.items;
        const [received] = (await fetchWalletTransactions({ userId: ada.id, afterEntryId: null, size: 1, filters: NO_FILTERS })).data.items;
        expect(sent).toMatchObject({ type: "internal_transfer", direction: "debit", amount: "5000.50", description: `Sent to @${ada.tag}`,
            transfer: { direction: "sent", counterpartyTag: ada.tag, counterpartyName: "Ada O.", note: "for lunch" } });
        expect(received).toMatchObject({ direction: "credit", description: `Received from @${tunde.tag}`, transfer: { direction: "received", counterpartyName: "Tunde B." } });
        expect((await fetchTransfer({ transferId: id, viewerId: ada.id })).data).toMatchObject({ direction: "received", counterparty: { tag: tunde.tag } });
        expect((await fetchTransfer({ transferId: id, viewerId: (await h.newUser()).id })).data).toBeNull();
    });

    it("too little money → insufficient_balance, nothing moves, nothing recorded", async () => {
        const poor = await h.newUser({ funds: "1000.00" });
        const ada = await h.newUser();
        await expect(h.send(poor.id, ada.id, "1000.01")).resolves.toMatchObject({ failure: "insufficient_balance", data: null });
        expect([await h.balance(poor.id), await h.balance(ada.id)]).toEqual(["1000.00", "0"]);
        expect(await h.transfersFrom(poor.id)).toHaveLength(0);
        expect(publishUserEvent).not.toHaveBeenCalled();
    });

    it("refuses yourself, an inactive or tagless recipient, and an inactive sender", async () => {
        const me = await h.newUser({ funds: "5000.00" });
        const suspended = await h.newUser({ status: "suspended" });
        const tagless = await h.newUser({ withTag: false });
        for (const to of [me.id, suspended.id, tagless.id]) {
            await expect(h.send(me.id, to, "500")).resolves.toMatchObject({ failure: "recipient_unavailable" });
        }
        const frozen = await h.newUser({ funds: "5000.00", status: "suspended" });
        await expect(h.send(frozen.id, (await h.newUser()).id, "500")).resolves.toMatchObject({ failure: "account_inactive" });
        expect(await h.balance(me.id)).toBe("5000.00");
    });

    it("the same idempotency key sends once — even when the retries race", async () => {
        const tunde = await h.newUser({ funds: "10000.00" });
        const ada = await h.newUser();
        const idempotencyKey = randomUUID();
        const results = await Promise.all([1, 2, 3].map(() => h.send(tunde.id, ada.id, "2000", { idempotencyKey })));
        expect(new Set(results.map((result) => result.data?.id)).size).toBe(1);
        expect(results.filter((result) => result.isNew)).toHaveLength(1);
        expect(await h.transfersFrom(tunde.id)).toHaveLength(1);
        expect(await h.balance(ada.id)).toBe("2000.00");
    });

    it("rows can't be edited or deleted; only completed → reversed is allowed", async () => {
        const tunde = await h.newUser({ funds: "1000.00" });
        const { data } = await h.send(tunde.id, (await h.newUser()).id, "500");
        await expect(db.updateTable("internal_transfers").set({ amount: "1" }).where("id", "=", data!.id).execute()).rejects.toThrow(/only completed|immutable/);
        await expect(db.updateTable("internal_transfers").set({ note: "edited", status: "reversed" }).where("id", "=", data!.id).execute()).rejects.toThrow(/immutable/);
        await expect(db.deleteFrom("internal_transfers").where("id", "=", data!.id).execute()).rejects.toThrow();
    });
});
