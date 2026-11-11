/**
 * Real-Postgres check of what's refused BEFORE any naira is held (skipped by default):
 *   DB_INTEGRATION=true DB_PORT=<port> npx jest tests/cryptoPurchases
 */
import { randomUUID } from "crypto";
import { disconnect } from "@/database";
import syncCryptoPurchase from "@/actions/cryptoPurchase/syncCryptoPurchase";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import { LEDGER_ACCOUNT_KIND } from "@/constants/ledger";
import { createHarness } from "./cryptoPurchaseHarness";

jest.mock("@/actions/pinVerification/createPinVerification");

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("crypto purchases against Postgres: guards", () => {
    const h = createHarness();
    const userBalance = (userId = h.userId) => h.balance(LEDGER_ACCOUNT_KIND.USER_AVAILABLE, { userId });

    beforeAll(() => h.setUp());
    beforeEach(async () => {
        await h.reset();
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } } as never);
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });
    afterAll(async () => {
        await h.tearDown();
        await disconnect();
    });

    it("a changed price → quote_changed with the new total, nothing held", async () => {
        const before = await userBalance();
        await expect(h.buy({ expectedTotal: "16000.00" })).resolves.toMatchObject({ failure: "quote_changed", quote: { total: "16500.00" } });
        expect(await userBalance()).toBe(before);
        expect(h.a.send).not.toHaveBeenCalled();
    });

    it("refuses a bad address, too little stock, and too little naira — before holding anything", async () => {
        const before = await userBalance();
        await expect(h.buy({ address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X" })).resolves.toMatchObject({ failure: "invalid_address" });
        await expect(h.buy({ address: "0x52908400098527886E0F7030069857D2E4169EE7" })).resolves.toMatchObject({ failure: "invalid_address" }); // EVM on TRC20

        h.a.getBalance.mockResolvedValue("10.5"); // needs 11 (10 + fee)
        await expect(h.buy()).resolves.toMatchObject({ failure: "stock_unavailable" });
        h.a.getBalance.mockResolvedValue(null); // can't tell → the check is skipped, not failed

        const poor = await h.newUser("1000.00");
        await expect(h.buy({ userId: poor })).resolves.toMatchObject({ failure: "insufficient_balance" });
        expect(await userBalance(poor)).toBe("1000.00");
        expect(await userBalance()).toBe(before);
        expect(h.a.send).not.toHaveBeenCalled();
    });

    it("amounts under the provider's minimum or our naira limits are refused", async () => {
        await expect(h.buy({ cryptoAmount: "0.5", expectedTotal: "2250.00" })).resolves.toMatchObject({ failure: "amount_out_of_range", limits: { minCrypto: "1" } });
        await expect(h.buy({ cryptoAmount: "5000", expectedTotal: "7501500.00" })).resolves.toMatchObject({ failure: "amount_out_of_range" });
    });

    it("the same idempotency key returns the original purchase — sent once", async () => {
        h.a.send.mockImplementation(async ({ externalId }) => h.sent(externalId));
        const key = randomUUID();
        const first = await h.buy({ idempotencyKey: key });
        const again = await h.buy({ idempotencyKey: key });
        expect(again).toMatchObject({ isNew: false, data: { id: (first.data as { id: string }).id } });
        expect(h.a.send).toHaveBeenCalledTimes(1);
    });

    it("a provider switch mid-flight: the open purchase finishes on its own provider", async () => {
        h.a.send.mockImplementation(async ({ externalId }) => h.sent(externalId));
        const { data } = await h.buy();
        const id = (data as { id: string }).id;
        await h.activate(h.b.name);

        h.a.getSend.mockResolvedValue(h.sent(id, { status: "completed" }));
        await expect(syncCryptoPurchase({ purchaseId: id })).resolves.toEqual({ data: { outcome: "completed" } });
        expect(h.b.getSend).not.toHaveBeenCalled();
        expect(await h.row(id)).toMatchObject({ provider: h.a.name });
    });

    it("an expired rate pauses buying (checked last: it changes the shared rate)", async () => {
        await h.setRate("1500", 1); // newest rate, expires in 1 ms
        await new Promise((resolve) => setTimeout(resolve, 5));
        await expect(h.buy()).resolves.toMatchObject({ failure: "rate_unavailable" });
    });
});
