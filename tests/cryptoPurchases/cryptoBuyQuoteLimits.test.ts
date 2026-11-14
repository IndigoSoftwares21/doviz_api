import fetchCryptoBuyQuote from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote";
import fetchActiveCryptoSendProvider from "@/actions/cryptoSendProvider/fetchActiveCryptoSendProvider";
import fetchCryptoBuyRate from "@/actions/cryptoBuyRate/fetchCryptoBuyRate";
import selectBuyAssets from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote/queries/selectBuyAsset";
import fetchSendTerms from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote/utils/fetchSendTerms";
import cryptoPurchaseFailureResponse from "@/utils/cryptoPurchases/cryptoPurchaseFailureResponse";
import fetchCryptoStock from "@/utils/cryptoPurchases/fetchCryptoStock";
import ACTION_FAILURE from "@/constants/actionFailure";

jest.mock("@/database", () => ({ db: {} }));
jest.mock("@/actions/cryptoSendProvider/fetchActiveCryptoSendProvider");
jest.mock("@/actions/cryptoBuyRate/fetchCryptoBuyRate");
jest.mock("@/actions/cryptoBuyQuote/fetchCryptoBuyQuote/queries/selectBuyAsset");
jest.mock("@/actions/cryptoBuyQuote/fetchCryptoBuyQuote/utils/fetchSendTerms");
jest.mock("@/utils/cryptoPurchases/fetchCryptoStock");

/** USDT at ₦1,380, KuCoin minimum 10 USDT, fee 1 USDT → cheapest buy ₦15,180. */
describe("crypto buy quote limits", () => {
    beforeEach(() => {
        jest.mocked(fetchActiveCryptoSendProvider).mockResolvedValue({ data: { name: "kucoin", environment: "live" } } as never);
        jest.mocked(selectBuyAssets).mockResolvedValue([
            { id: "a-1", symbol: "USDT", network: "TRC20", name: "Tether", providerAssetId: "USDT:trx", memoRequired: false },
        ] as never);
        jest.mocked(fetchCryptoBuyRate).mockResolvedValue({ data: { id: "r-1", rate: "1380", markupPercent: "0", expiresAt: new Date() } } as never);
        jest.mocked(fetchSendTerms).mockResolvedValue({ fee: "1", minAmount: "10", precision: 6, memoRequired: false, isEnabled: true });
        jest.mocked(fetchCryptoStock).mockResolvedValue({ status: "known", balance: "100000" });
    });

    it("below the minimum: still converts (preview), and the minimum is in naira", async () => {
        const result = await fetchCryptoBuyQuote({ assetId: "a-1", nairaTotal: "5000.00" });
        expect(result.data).toBeNull();
        expect(result.failure).toBe(ACTION_FAILURE.AMOUNT_OUT_OF_RANGE);
        expect(result.preview?.cryptoAmount).toBe("2.623188");
        expect(result.limits).toMatchObject({ minCrypto: "10", minTotal: "15180.00", tooHigh: false });
        expect(cryptoPurchaseFailureResponse({ failure: result.failure, limits: result.limits })?.message).toBe(
            "The minimum is ₦15,180.00.",
        );
    });

    it("exactly the naira minimum buys the coin minimum", async () => {
        const result = await fetchCryptoBuyQuote({ assetId: "a-1", nairaTotal: "15180.00" });
        expect(result.data?.cryptoAmount).toBe("10");
    });

    it("over the maximum: converts, says the maximum", async () => {
        const result = await fetchCryptoBuyQuote({ assetId: "a-1", nairaTotal: "6000000.00" });
        expect(result.preview).not.toBeNull();
        expect(cryptoPurchaseFailureResponse({ failure: result.failure, limits: result.limits })?.message).toBe(
            "You can buy up to ₦5,000,000.00 at a time.",
        );
    });

    it("too little to cover the network fee: nothing to preview", async () => {
        const result = await fetchCryptoBuyQuote({ assetId: "a-1", nairaTotal: "1000.00" });
        expect(result.preview).toBeNull();
        expect(result.limits?.minTotal).toBe("15180.00");
    });

    describe("stock", () => {
        it("more than we hold: converts, says how much is available (stock less the fee)", async () => {
            jest.mocked(fetchCryptoStock).mockResolvedValue({ status: "known", balance: "51" });
            const result = await fetchCryptoBuyQuote({ assetId: "a-1", nairaTotal: "100000.00" });
            expect(result.data).toBeNull();
            expect(result.failure).toBe(ACTION_FAILURE.AMOUNT_OUT_OF_RANGE);
            expect(result.limits).toMatchObject({ maxCrypto: "50", maxTotal: "70380.00", stockLimited: true, tooHigh: true });
            expect(cryptoPurchaseFailureResponse({ failure: result.failure, limits: result.limits })?.message).toBe(
                "You can buy up to ₦70,380.00 (50 USDT) right now.",
            );
        });

        it("exactly what we hold still buys", async () => {
            jest.mocked(fetchCryptoStock).mockResolvedValue({ status: "known", balance: "51" });
            const result = await fetchCryptoBuyQuote({ assetId: "a-1", nairaTotal: "70380.00" });
            expect(result.data?.cryptoAmount).toBe("50");
        });

        it("not enough for the minimum send: sold out", async () => {
            jest.mocked(fetchCryptoStock).mockResolvedValue({ status: "known", balance: "10.5" });
            const result = await fetchCryptoBuyQuote({ assetId: "a-1", nairaTotal: "20000.00" });
            expect(result.failure).toBe(ACTION_FAILURE.STOCK_UNAVAILABLE);
            expect(cryptoPurchaseFailureResponse({ failure: result.failure })?.code).toBe(503);
        });

        it("balance lookup failed: sold out, never unlimited", async () => {
            jest.mocked(fetchCryptoStock).mockResolvedValue({ status: "unknown" });
            const result = await fetchCryptoBuyQuote({ assetId: "a-1", nairaTotal: "20000.00" });
            expect(result.failure).toBe(ACTION_FAILURE.STOCK_UNAVAILABLE);
        });

        it("provider can't report stock: only our own cap applies", async () => {
            jest.mocked(fetchCryptoStock).mockResolvedValue({ status: "unlimited" });
            const result = await fetchCryptoBuyQuote({ assetId: "a-1", nairaTotal: "100000.00" });
            expect(result.data).not.toBeNull();
        });
    });
});
