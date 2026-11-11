import fetchCryptoBuyQuote from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote";
import fetchActiveCryptoSendProvider from "@/actions/cryptoSendProvider/fetchActiveCryptoSendProvider";
import fetchCryptoBuyRate from "@/actions/cryptoBuyRate/fetchCryptoBuyRate";
import selectBuyAssets from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote/queries/selectBuyAsset";
import fetchSendTerms from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote/utils/fetchSendTerms";
import cryptoPurchaseFailureResponse from "@/utils/cryptoPurchases/cryptoPurchaseFailureResponse";
import ACTION_FAILURE from "@/constants/actionFailure";

jest.mock("@/database", () => ({ db: {} }));
jest.mock("@/actions/cryptoSendProvider/fetchActiveCryptoSendProvider");
jest.mock("@/actions/cryptoBuyRate/fetchCryptoBuyRate");
jest.mock("@/actions/cryptoBuyQuote/fetchCryptoBuyQuote/queries/selectBuyAsset");
jest.mock("@/actions/cryptoBuyQuote/fetchCryptoBuyQuote/utils/fetchSendTerms");

/** USDT at ₦1,380, KuCoin minimum 10 USDT, fee 1 USDT → cheapest buy ₦15,180. */
describe("crypto buy quote limits", () => {
    beforeEach(() => {
        jest.mocked(fetchActiveCryptoSendProvider).mockResolvedValue({ data: { name: "kucoin", environment: "live" } } as never);
        jest.mocked(selectBuyAssets).mockResolvedValue([
            { id: "a-1", symbol: "USDT", network: "TRC20", name: "Tether", providerAssetId: "USDT:trx", memoRequired: false },
        ] as never);
        jest.mocked(fetchCryptoBuyRate).mockResolvedValue({ data: { id: "r-1", rate: "1380", markupPercent: "0", expiresAt: new Date() } } as never);
        jest.mocked(fetchSendTerms).mockResolvedValue({ fee: "1", minAmount: "10", precision: 6, memoRequired: false, isEnabled: true });
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
});
