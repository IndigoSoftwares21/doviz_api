/**
 * Real-Postgres: buying a coin priced from the market (skipped by default):
 *   DB_INTEGRATION=true DB_PORT=<port> npx jest tests/cryptoPurchases
 */
import { randomUUID } from "crypto";
import { db, disconnect } from "@/database";
import createCryptoPurchase from "@/actions/cryptoPurchase/createCryptoPurchase";
import fetchCryptoBuyQuote from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import cryptoSendProviderRegistry from "@/services/cryptoSends/cryptoSendProviderRegistry";
import { CryptoSendProvider } from "@/services/cryptoSends/cryptoSendProvider";
import { createHarness } from "./cryptoPurchaseHarness";

jest.mock("@/actions/pinVerification/createPinVerification");

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;
const ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

run("crypto purchases against Postgres: market-priced coins", () => {
    const h = createHarness(); // for newUser
    const tag = randomUUID().slice(0, 6);
    const symbol = `M${tag}`.toUpperCase();
    const provider = {
        name: `mkt${tag}`,
        environment: "sandbox" as const,
        listSendableAssets: jest.fn(),
        getBalance: jest.fn().mockResolvedValue(null),
        getUsdtPrice: jest.fn().mockResolvedValue("2000"),
        send: jest.fn(async ({ externalId, amount }: { externalId: string; amount: string }) => ({ externalId, providerReference: `w-${externalId.slice(0, 8)}`, status: "pending", amount, fee: null, txHash: null, failureReason: null })),
        getSend: jest.fn().mockResolvedValue(null),
    };
    let assetId = "";
    let userId = "";
    let usdtRateId = "";
    let previousActive: string | undefined;
    const buy = (fields: { expectedTotal: string; expectedCryptoAmount: string | null }) =>
        createCryptoPurchase({ userId, assetId, address: ADDRESS, memo: null, cryptoAmount: null, nairaTotal: "50000.00", idempotencyKey: randomUUID(), pin: "4827", ipAddress: null, userAgent: null, ...fields });

    beforeAll(async () => {
        const asset = await db.insertInto("crypto_assets").values({ symbol, network: "ETHEREUM", name: "Test ETH", decimals: 18, isEnabled: false, isBuyEnabled: true }).returning(["id"]).executeTakeFirstOrThrow();
        assetId = asset.id;
        await db.insertInto("crypto_provider_assets").values({
            assetId, provider: provider.name, environment: "sandbox", providerAssetId: `${symbol}:eth`, providerCode: symbol, isEnabled: true,
            canSend: true, minSend: "0.003", sendFee: "0.0015", sendPrecision: 8, memoRequired: false, syncedAt: new Date(),
        }).execute();
        const rate = await db.insertInto("crypto_buy_rates").values({ symbol: "USDT", currency: "NGN", rate: "1380", markupPercent: "0", effectiveFrom: new Date(), expiresAt: new Date(Date.now() + 3600_000), setBy: "test" })
            .returning(["id"]).executeTakeFirstOrThrow();
        usdtRateId = rate.id;
        await db.insertInto("crypto_buy_markups").values({ symbol, markupPercent: "1.5", updatedBy: "test" }).execute();
        userId = await h.newUser("100000.00");
        previousActive = (await db.selectFrom("provider_settings").select(["activeProvider"]).where("service", "=", "crypto_sends").executeTakeFirst())?.activeProvider;
        cryptoSendProviderRegistry.reset();
        cryptoSendProviderRegistry.register(provider as unknown as CryptoSendProvider);
        await db.updateTable("provider_settings").set({ activeProvider: provider.name }).where("service", "=", "crypto_sends").execute();
    });
    beforeEach(() => {
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } } as never);
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });
    afterAll(async () => {
        if (previousActive) await db.updateTable("provider_settings").set({ activeProvider: previousActive }).where("service", "=", "crypto_sends").execute();
        cryptoSendProviderRegistry.reset();
        await disconnect();
    });

    it("prices from USDT rate × live price × markup, and the purchase records exactly how", async () => {
        const { data: quote } = await fetchCryptoBuyQuote({ assetId, nairaTotal: "50000.00" });
        expect(quote).toMatchObject({ priceSource: "market", marketPriceUsdt: "2000", markupPercent: "1.5", rateId: usdtRateId, unitPrice: "2801400.00" });

        const result = await buy({ expectedTotal: quote!.total, expectedCryptoAmount: quote!.cryptoAmount });
        expect(result.failure).toBeNull();
        const row = await db.selectFrom("crypto_purchases").select(["priceSource", "marketPriceUsdt", "markupPercent", "rateId", "unitPrice", "cryptoAmount"])
            .where("id", "=", (result.data as { id: string }).id).executeTakeFirstOrThrow();
        expect(row).toMatchObject({ priceSource: "market", rateId: usdtRateId, unitPrice: "2801400.00" });
        expect(Number(row.marketPriceUsdt)).toBe(2000);
        expect(Number(row.markupPercent)).toBe(1.5);
        expect(Number(row.cryptoAmount)).toBe(Number(quote!.cryptoAmount));
    });

    it("a fresh price giving up to 0.5% less coin goes ahead; more than that → quote_changed, nothing held", async () => {
        const { data: quote } = await fetchCryptoBuyQuote({ assetId, nairaTotal: "50000.00" });
        const seen = (factor: number) => (Number(quote!.cryptoAmount) * factor).toFixed(8);

        await expect(buy({ expectedTotal: quote!.total, expectedCryptoAmount: seen(1.004) })).resolves.toMatchObject({ failure: null, isNew: true });
        const sends = provider.send.mock.calls.length;
        await expect(buy({ expectedTotal: quote!.total, expectedCryptoAmount: seen(1.01) })).resolves.toMatchObject({ failure: "quote_changed" });
        expect(provider.send.mock.calls.length).toBe(sends);
    });

    it("how a purchase was priced can never be edited", async () => {
        const { id } = await db.selectFrom("crypto_purchases").select(["id"]).where("priceSource", "=", "market").where("assetId", "=", assetId).executeTakeFirstOrThrow();
        for (const change of [{ marketPriceUsdt: "1" }, { markupPercent: "0" }, { priceSource: "rate", marketPriceUsdt: null }]) {
            await expect(db.updateTable("crypto_purchases").set(change).where("id", "=", id).execute()).rejects.toThrow(/immutable/);
        }
    });

    it("no USDT rate in force → the coin can't be bought (no stale price)", async () => {
        // A newer USDT rate that has already run out replaces the good one.
        const now = Date.now();
        await db.insertInto("crypto_buy_rates").values({ symbol: "USDT", currency: "NGN", rate: "1380", markupPercent: "0", effectiveFrom: new Date(now), expiresAt: new Date(now + 5), setBy: "test" }).execute();
        await new Promise((resolve) => setTimeout(resolve, 20));
        await expect(fetchCryptoBuyQuote({ assetId, nairaTotal: "50000.00" })).resolves.toMatchObject({ data: null, failure: "rate_unavailable" });
    });
});
