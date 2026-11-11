/**
 * Real-Postgres check of the crypto purchase money path (skipped by default).
 * Run against a DISPOSABLE, fully migrated database — money rows can't be deleted:
 *   DB_INTEGRATION=true DB_PORT=<port> npx jest tests/cryptoPurchases
 */
import { disconnect, db } from "@/database";
import syncCryptoPurchase from "@/actions/cryptoPurchase/syncCryptoPurchase";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import CryptoSendProviderError from "@/services/cryptoSends/cryptoSendProviderError";
import { LEDGER_ACCOUNT_KIND } from "@/constants/ledger";
import { createHarness, TRON_ADDRESS } from "./cryptoPurchaseHarness";

jest.mock("@/actions/pinVerification/createPinVerification");

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("crypto purchases against Postgres: sending", () => {
    const h = createHarness();
    const userBalance = () => h.balance(LEDGER_ACCOUNT_KIND.USER_AVAILABLE, { userId: h.userId });

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

    it("holds the naira, sends exactly the quoted coin, and settles on the provider's confirmation", async () => {
        const before = await userBalance();
        h.a.send.mockImplementation(async ({ externalId }) => h.sent(externalId));
        const { data, isNew } = await h.buy();

        expect(isNew).toBe(true);
        expect(data).toMatchObject({ status: "pending", cryptoAmount: "10", networkFee: "1", unitPrice: "1500.00", nairaAmount: "15000.00", nairaFee: "1500.00", total: "16500.00" });
        expect(h.a.send).toHaveBeenCalledWith(expect.objectContaining({ providerAssetId: `${h.symbol}:trx`, address: TRON_ADDRESS, amount: "10", memo: null }));
        expect(Number(before) - Number(await userBalance())).toBe(16500);

        const id = (data as { id: string }).id;
        h.a.getSend.mockResolvedValue(h.sent(id, { status: "completed", fee: "1", txHash: "0xabc" }));
        await expect(syncCryptoPurchase({ purchaseId: id })).resolves.toEqual({ data: { outcome: "completed" } });

        expect(await h.row(id)).toMatchObject({ status: "completed", txHash: "0xabc" });
        expect(await h.balance(LEDGER_ACCOUNT_KIND.CRYPTO_SENDS_IN_TRANSIT, { provider: h.a.name })).toBe("0.00");
        const stock = await db.selectFrom("crypto_stock_movements").select(["quantity"]).where("purchaseId", "=", id).executeTakeFirstOrThrow();
        expect(Number(stock.quantity)).toBe(-11); // 10 sent + 1 fee
    });

    it("refunds at once when the provider refuses the send", async () => {
        const before = await userBalance();
        h.a.send.mockRejectedValue(new CryptoSendProviderError({ code: "rejected", status: 400, providerMessage: "Withdrawal amount below minimum" }));
        const { data } = await h.buy();

        expect(data).toMatchObject({ status: "failed", failureReason: expect.stringMatching(/naira has been returned/) });
        expect(await userBalance()).toBe(before);
    });

    it("never refunds an unknown outcome: processing → needs_review, then settles if the coin turns up", async () => {
        const before = await userBalance();
        h.a.send.mockRejectedValue(new CryptoSendProviderError({ code: "unavailable", status: null, providerMessage: "timeout" }));
        const { data } = await h.buy();
        const id = (data as { id: string }).id;
        expect(data).toMatchObject({ status: "processing" });

        await expect(syncCryptoPurchase({ purchaseId: id })).resolves.toEqual({ data: { outcome: "pending" } });
        await db.updateTable("crypto_purchases").set({ requestedAt: new Date(Date.now() - 31 * 60_000) }).where("id", "=", id).execute();
        await expect(syncCryptoPurchase({ purchaseId: id })).resolves.toEqual({ data: { outcome: "needs_review" } });
        await expect(syncCryptoPurchase({ purchaseId: id })).resolves.toEqual({ data: { outcome: "unchanged" } });
        expect(Number(before) - Number(await userBalance())).toBe(16500); // still held, not refunded

        h.a.getSend.mockResolvedValue(h.sent(id, { status: "completed", txHash: "0xlate" }));
        await expect(syncCryptoPurchase({ purchaseId: id })).resolves.toEqual({ data: { outcome: "completed" } });
        expect(await h.row(id)).toMatchObject({ status: "completed", txHash: "0xlate" });
    });

    it("refunds when the provider's own record says the send failed", async () => {
        const before = await userBalance();
        h.a.send.mockImplementation(async ({ externalId }) => h.sent(externalId));
        const { data } = await h.buy();
        const id = (data as { id: string }).id;

        h.a.getSend.mockResolvedValue(h.sent(id, { status: "failed", failureReason: "chain congested" }));
        await expect(syncCryptoPurchase({ purchaseId: id })).resolves.toEqual({ data: { outcome: "refunded" } });
        expect(await userBalance()).toBe(before);
    });
});
