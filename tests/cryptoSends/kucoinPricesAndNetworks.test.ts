import KucoinClient, { KucoinHttp, KucoinHttpRequest } from "@/services/cryptoSends/providers/kucoin/kucoinClient";
import KucoinCryptoSendProvider from "@/services/cryptoSends/providers/kucoin/kucoinCryptoSendProvider";
import mapKucoinCurrency from "@/services/cryptoSends/providers/kucoin/mapKucoinCurrency";
import { BUYABLE_ASSETS, ourNetwork } from "../../scripts/crypto-buy/buyableAssets";
import isValidCryptoAddress, { BUYABLE_NETWORKS } from "@/utils/cryptoPurchases/isValidCryptoAddress";

const CONFIG = { baseUrl: "https://kucoin.test", apiKey: "k", apiSecret: "s", apiPassphrase: "p", keyVersion: "2", accountMode: "classic" as const };

/** Answers one public price request. */
const kucoinWith = (ticker: unknown) => {
    const requests: KucoinHttpRequest[] = [];
    const http: KucoinHttp = {
        request: (request) => {
            requests.push(request);
            return Promise.resolve({ status: 200, data: { code: "200000", data: ticker } });
        },
    };
    return { provider: new KucoinCryptoSendProvider({ client: new KucoinClient({ config: CONFIG, http, now: () => 1 }) }), requests };
};

describe("KuCoin live prices", () => {
    it("ETH in USDT is the best ask, from the public level-1 order book (unsigned)", async () => {
        const { provider, requests } = kucoinWith({ price: "2071.59", bestBid: "2071.58", bestAsk: "2071.60" });
        await expect(provider.getUsdtPrice({ symbol: "eth" })).resolves.toBe("2071.6");
        expect(requests[0].url).toBe("/api/v1/market/orderbook/level1?symbol=ETH-USDT");
        expect(requests[0].headers["KC-API-KEY"]).toBeUndefined();
    });

    it("falls back to the last trade without an ask; no usable price throws (never a guess)", async () => {
        await expect(kucoinWith({ price: "1.0007", bestAsk: null }).provider.getUsdtPrice({ symbol: "USDC" })).resolves.toBe("1.0007");
        await expect(kucoinWith(null).provider.getUsdtPrice({ symbol: "ETH" })).rejects.toThrow("no ETH-USDT price");
        await expect(kucoinWith({ price: "0", bestAsk: "0" }).provider.getUsdtPrice({ symbol: "ETH" })).rejects.toThrow();
    });
});

describe("KuCoin chains → our networks", () => {
    const network = (symbol: string, chain: string) => ourNetwork({ provider: "kucoin", symbol, providerNetwork: chain });

    it("maps the chains we can check, and ETH on mainnet is the ETHEREUM row selling already uses", () => {
        expect(network("USDT", "trx")).toBe("TRC20");
        expect(network("USDT", "eth")).toBe("ERC20");
        expect(network("USDC", "eth")).toBe("ERC20");
        expect(network("ETH", "eth")).toBe("ETHEREUM");
        expect(network("ETH", "bsc")).toBe("BEP20");
        expect(network("USDC", "sol")).toBe("SOLANA");
        expect(network("USDT", "matic")).toBe("POLYGON");
    });

    it("never guesses a chain we can't validate (or that's deprecated)", () => {
        for (const chain of ["ton2", "kcc", "near", "aptos", "statemint", "sui", "xtz", "cfx", "monad"]) expect(network("USDT", chain)).toBeNull();
    });

    it("every buyable coin is on a network with an address check", () => {
        for (const asset of BUYABLE_ASSETS) expect(BUYABLE_NETWORKS).toContain(asset.network);
        expect(isValidCryptoAddress({ network: "ETHEREUM", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" })).toBe(true);
    });

    it("TON's memo requirement comes from KuCoin's needTag", () => {
        const [ton] = mapKucoinCurrency({
            currency: { currency: "USDT", precision: 8, chains: [{ chainId: "ton", withdrawalMinFee: "0.5", withdrawalMinSize: "1", withdrawPrecision: 6, needTag: true, isWithdrawEnabled: true }] } as never,
        });
        expect(ton.terms.memoRequired).toBe(true);
        expect(network(ton.symbol, ton.providerNetwork)).toBe("TON");
    });
});
