import fetchCryptoBuyPrice from "@/actions/cryptoBuyPrice/fetchCryptoBuyPrice";
import fetchCryptoBuyRate from "@/actions/cryptoBuyRate/fetchCryptoBuyRate";
import selectBuyMarkup from "@/actions/cryptoBuyPrice/fetchCryptoBuyPrice/queries/selectBuyMarkup";
import { resetMarketPrices } from "@/actions/cryptoBuyPrice/fetchCryptoBuyPrice/utils/fetchMarketPrice";
import { CryptoSendProvider } from "@/services/cryptoSends/cryptoSendProvider";

jest.mock("@/database", () => ({ db: {} }));
jest.mock("@/actions/cryptoBuyRate/fetchCryptoBuyRate");
jest.mock("@/actions/cryptoBuyPrice/fetchCryptoBuyPrice/queries/selectBuyMarkup");

const LATER = new Date(Date.now() + 3600_000);
const USDT_RATE = { id: "rate-usdt", rate: "1380", markupPercent: "0.5", expiresAt: LATER };
let names = 0;
/** A fresh provider name per test: live prices are cached per provider. */
const provider = (getUsdtPrice?: jest.Mock) =>
    ({ name: `p${++names}`, environment: "production", ...(getUsdtPrice ? { getUsdtPrice } : {}) }) as unknown as CryptoSendProvider;
const rates = (bySymbol: Record<string, typeof USDT_RATE | null>) =>
    jest.mocked(fetchCryptoBuyRate).mockImplementation(async ({ symbol }) => ({ data: bySymbol[symbol] ?? null }));

describe("our naira price per coin", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        resetMarketPrices();
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
        jest.mocked(selectBuyMarkup).mockResolvedValue({ markupPercent: "1.5" });
    });
    afterEach(() => jest.useRealTimers());

    it("USDT (and any coin with its own rate in force) uses the rate we set", async () => {
        rates({ USDT: USDT_RATE, ETH: { ...USDT_RATE, id: "rate-eth", rate: "3000000" } });
        const price = jest.fn();
        await expect(fetchCryptoBuyPrice({ provider: provider(price), symbol: "USDT" })).resolves.toMatchObject({ data: { rateId: "rate-usdt", rate: "1380", source: "rate", marketPriceUsdt: null } });
        await expect(fetchCryptoBuyPrice({ provider: provider(price), symbol: "ETH" })).resolves.toMatchObject({ data: { rateId: "rate-eth", rate: "3000000", source: "rate" } });
        expect(price).not.toHaveBeenCalled();
    });

    it("ETH from the market: USDT rate × live price; markup = USDT's + the coin's; a short-lived quote", async () => {
        rates({ USDT: USDT_RATE });
        const { data } = await fetchCryptoBuyPrice({ provider: provider(jest.fn().mockResolvedValue("2071.6")), symbol: "ETH" });
        expect(data).toMatchObject({ rateId: "rate-usdt", rate: "2858808", markupPercent: "2", source: "market", marketPriceUsdt: "2071.6" });
        expect(data!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
    });

    it("a coin without a markup row gets the default (1.5%)", async () => {
        rates({ USDT: USDT_RATE });
        jest.mocked(selectBuyMarkup).mockResolvedValue(undefined);
        const { data } = await fetchCryptoBuyPrice({ provider: provider(jest.fn().mockResolvedValue("1")), symbol: "USDC" });
        expect(data?.markupPercent).toBe("2");
    });

    it.each([
        ["no USDT rate in force", null, jest.fn().mockResolvedValue("2000")],
        ["the provider can't price coins", USDT_RATE, undefined],
        ["the price lookup fails", USDT_RATE, jest.fn().mockRejectedValue(new Error("timeout"))],
        ["the price isn't positive", USDT_RATE, jest.fn().mockResolvedValue("0")],
    ])("unavailable when %s — never a stale guess", async (_, usdt, getPrice) => {
        rates({ USDT: usdt });
        await expect(fetchCryptoBuyPrice({ provider: provider(getPrice), symbol: "ETH" })).resolves.toEqual({ data: null });
    });

    it("USDT with no rate of its own is unavailable (it's the base)", async () => {
        rates({});
        await expect(fetchCryptoBuyPrice({ provider: provider(jest.fn()), symbol: "USDT" })).resolves.toEqual({ data: null });
    });

    it("refuses a live price over 10% from the one used under a minute ago; accepts it after", async () => {
        jest.useFakeTimers({ now: new Date("2026-11-12T10:00:00Z") });
        rates({ USDT: USDT_RATE });
        const getPrice = jest.fn().mockResolvedValueOnce("2000").mockResolvedValueOnce("2300").mockResolvedValueOnce("2100").mockResolvedValue("2500");
        const p = provider(getPrice);
        const eth = () => fetchCryptoBuyPrice({ provider: p, symbol: "ETH" }).then(({ data }) => data?.marketPriceUsdt ?? null);

        expect(await eth()).toBe("2000");
        jest.advanceTimersByTime(16_000); // past the 15 s cache
        expect(await eth()).toBeNull(); // +15%: refused
        jest.advanceTimersByTime(16_000);
        expect(await eth()).toBe("2100"); // +5%: fine
        jest.advanceTimersByTime(16_000);
        expect(await eth()).toBeNull(); // +19% within the minute: refused
        jest.advanceTimersByTime(61_000);
        expect(await eth()).toBe("2500"); // the market really moved: accepted a minute on
    });

    it("reuses a live price for 15 s", async () => {
        rates({ USDT: USDT_RATE });
        const getPrice = jest.fn().mockResolvedValue("2000");
        const p = provider(getPrice);
        await fetchCryptoBuyPrice({ provider: p, symbol: "ETH" });
        await fetchCryptoBuyPrice({ provider: p, symbol: "ETH" });
        expect(getPrice).toHaveBeenCalledTimes(1);
    });
});
