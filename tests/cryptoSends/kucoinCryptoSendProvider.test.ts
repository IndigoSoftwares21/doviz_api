import { createHmac } from "crypto";
import KucoinClient, { KucoinHttp, KucoinHttpRequest } from "@/services/cryptoSends/providers/kucoin/kucoinClient";
import KucoinCryptoSendProvider from "@/services/cryptoSends/providers/kucoin/kucoinCryptoSendProvider";
import { mapKucoinStatus } from "@/services/cryptoSends/providers/kucoin/mapKucoinSend";
import { KucoinConfig } from "@/services/cryptoSends/providers/kucoin/getKucoinConfig";

const CONFIG: KucoinConfig = {
    baseUrl: "https://kucoin.test",
    apiKey: "key-123",
    apiSecret: "secret-456",
    apiPassphrase: "pass-789",
    keyVersion: "2",
    accountMode: "classic",
};
const NOW = 1_762_840_000_000;
const ID = "0b6c3a3e-1f2d-4c5b-8a9e-2d4f6a8b0c1d";

type Reply = { status: number; data: unknown } | Error;

/** Records requests and answers by "METHOD url" (url includes the query). */
class FakeKucoinHttp implements KucoinHttp {
    readonly requests: KucoinHttpRequest[] = [];
    private readonly replies = new Map<string, Reply>();

    reply(key: string, reply: Reply) {
        this.replies.set(key, reply);
        return this;
    }

    request(request: KucoinHttpRequest) {
        this.requests.push(request);
        const reply = this.replies.get(`${request.method} ${request.url}`);
        if (!reply) return Promise.reject(new Error(`No fake reply for ${request.method} ${request.url}`));
        return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
    }
}

const ok = (data: unknown) => ({ status: 200, data: { code: "200000", data } });
const fail = (status: number, code: string, msg: string) => ({ status, data: { code, msg } });
const kucoin = (http: FakeKucoinHttp, config: Partial<KucoinConfig> = {}) =>
    new KucoinCryptoSendProvider({ client: new KucoinClient({ config: { ...CONFIG, ...config }, http, now: () => NOW }) });
const send = (provider: KucoinCryptoSendProvider, memo: string | null = null) =>
    provider.send({ externalId: ID, providerAssetId: "USDT:trx", address: "TXyz1234567890abcdefghijkLMNOPQRS", memo, amount: "25.5" });
const hmac = (value: string) => createHmac("sha256", CONFIG.apiSecret).update(value).digest("base64");

const usdtCurrency = {
    currency: "USDT", precision: 8,
    chains: [
        { chainName: "TRC20", chainId: "trx", withdrawalMinFee: "1", withdrawalMinSize: "10", withdrawPrecision: 6, needTag: false, isWithdrawEnabled: true },
        { chainName: "BEP20", chainId: "bsc", withdrawalMinFee: "0.3", withdrawalMinSize: "5", withdrawPrecision: 8, needTag: false, isWithdrawEnabled: true },
        { chainName: "ERC20", chainId: "eth", withdrawalMinFee: "4.5", withdrawalMinSize: "15", withdrawPrecision: 6, needTag: false, isWithdrawEnabled: false },
    ],
};

describe("KucoinCryptoSendProvider", () => {
    it("signs private requests: HMAC of timestamp + METHOD + path?query + body, and an HMAC'd passphrase", async () => {
        const http = new FakeKucoinHttp().reply("GET /api/v1/accounts?type=main&currency=USDT", ok([]));
        await kucoin(http).getBalance({ providerAssetId: "USDT:trx" });

        const { headers } = http.requests[0];
        expect(headers["KC-API-KEY"]).toBe("key-123");
        expect(headers["KC-API-TIMESTAMP"]).toBe(String(NOW));
        expect(headers["KC-API-SIGN"]).toBe(hmac(`${NOW}GET/api/v1/accounts?type=main&currency=USDT`));
        expect(headers["KC-API-PASSPHRASE"]).toBe(hmac("pass-789"));
        expect(headers["KC-API-KEY-VERSION"]).toBe("2");
    });

    it("sends with our id as the remark (classic account) and signs the exact body", async () => {
        const http = new FakeKucoinHttp().reply("POST /api/v3/withdrawals", ok({ withdrawalId: "670deec84d64da0007d7c946" }));
        const result = await send(kucoin(http));

        const body = { currency: "USDT", chain: "trx", toAddress: "TXyz1234567890abcdefghijkLMNOPQRS", amount: "25.5", withdrawType: "ADDRESS", isInner: false, remark: ID };
        expect(JSON.parse(http.requests[0].data!)).toEqual(body);
        expect(http.requests[0].headers["KC-API-SIGN"]).toBe(hmac(`${NOW}POST/api/v3/withdrawals${JSON.stringify(body)}`));
        expect(result).toEqual({ externalId: ID, providerReference: "670deec84d64da0007d7c946", status: "pending", amount: "25.5", fee: null, txHash: null, failureReason: null });
    });

    it("uses the unified-account endpoint when configured, and includes a memo only when set", async () => {
        const http = new FakeKucoinHttp().reply("POST /api/ua/v2/asset/withdrawal", ok({ withdrawalId: "w-2" }));
        await send(kucoin(http, { accountMode: "unified" }), "12345");
        expect(JSON.parse(http.requests[0].data!)).toMatchObject({ memo: "12345", remark: ID });
    });

    it("maps statuses without ever guessing a failure", () => {
        expect(mapKucoinStatus({ status: "SUCCESS" })).toBe("completed");
        expect(mapKucoinStatus({ status: "FAILURE" })).toBe("failed");
        for (const status of ["PROCESSING", "WALLET_PROCESSING", "REVIEW", "SOMETHING_NEW"]) {
            expect(mapKucoinStatus({ status })).toBe("pending");
        }
    });

    it("separates our setup (configuration) and a refusal (rejected) from not knowing (unavailable)", async () => {
        const whitelist = new FakeKucoinHttp().reply("POST /api/v3/withdrawals", fail(200, "260325", "Already set withdraw whitelist, this address is not favorite address"));
        await expect(send(kucoin(whitelist))).rejects.toMatchObject({ code: "configuration" });

        const broke = new FakeKucoinHttp().reply("POST /api/v3/withdrawals", fail(400, "200004", "Balance insufficient"));
        await expect(send(kucoin(broke))).rejects.toMatchObject({ code: "rejected" });

        const down = new FakeKucoinHttp().reply("POST /api/v3/withdrawals", fail(503, "", "Service unavailable"));
        await expect(send(kucoin(down))).rejects.toMatchObject({ code: "unavailable", retryable: true });

        const timeout = new FakeKucoinHttp().reply("POST /api/v3/withdrawals", new Error("ETIMEDOUT"));
        await expect(send(kucoin(timeout))).rejects.toMatchObject({ code: "unavailable" });

        const garbage = new FakeKucoinHttp().reply("POST /api/v3/withdrawals", { status: 200, data: "<html>" });
        await expect(send(kucoin(garbage))).rejects.toMatchObject({ code: "invalid_response" });
    });

    it("looks a send up by KuCoin's id, mapping the hash and fee", async () => {
        const http = new FakeKucoinHttp().reply(
            "GET /api/v1/withdrawals/w-1",
            ok({ id: "w-1", status: "SUCCESS", amount: "25.50000000", fee: "1.00000000", walletTxId: "abc123", remark: ID }),
        );
        await expect(kucoin(http).getSend({ externalId: ID, providerReference: "w-1", providerAssetId: "USDT:trx" })).resolves.toEqual({
            externalId: ID, providerReference: "w-1", status: "completed", amount: "25.50000000", fee: "1.00000000", txHash: "abc123", failureReason: null,
        });
    });

    it("finds a send whose response was lost by searching for our remark, else null", async () => {
        const history = "GET /api/v1/withdrawals?currency=USDT&currentPage=1&pageSize=100";
        const found = new FakeKucoinHttp().reply(history, ok({ items: [{ id: "w-9", status: "FAILURE", remark: "other" }, { id: "w-1", status: "PROCESSING", remark: ID }] }));
        await expect(kucoin(found).getSend({ externalId: ID, providerReference: null, providerAssetId: "USDT:trx" })).resolves.toMatchObject({ providerReference: "w-1", status: "pending" });

        const none = new FakeKucoinHttp().reply(history, ok({ items: [] }));
        await expect(kucoin(none).getSend({ externalId: ID, providerReference: null, providerAssetId: "USDT:trx" })).resolves.toBeNull();

        const gone = new FakeKucoinHttp().reply("GET /api/v1/withdrawals/w-x", fail(404, "", "Withdrawal not found"));
        await expect(kucoin(gone).getSend({ externalId: ID, providerReference: "w-x", providerAssetId: "USDT:trx" })).resolves.toBeNull();
    });

    it("lists one sendable asset per chain of USDT, USDC and ETH, from the public currency endpoint (unsigned)", async () => {
        const ethCurrency = { currency: "ETH", precision: 8, chains: [{ chainId: "base", withdrawalMinFee: "0.0001", withdrawalMinSize: "0.0002", withdrawPrecision: 8, needTag: false, isWithdrawEnabled: true }] };
        const http = new FakeKucoinHttp()
            .reply("GET /api/v3/currencies/USDT", ok(usdtCurrency))
            .reply("GET /api/v3/currencies/USDC", ok({ currency: "USDC", precision: 8, chains: [] }))
            .reply("GET /api/v3/currencies/ETH", ok(ethCurrency));
        const assets = await kucoin(http).listSendableAssets();

        expect(http.requests.every((request) => request.headers["KC-API-SIGN"] === undefined)).toBe(true);
        expect(assets.map((asset) => asset.providerAssetId)).toEqual(["USDT:trx", "USDT:bsc", "USDT:eth", "ETH:base"]);
        expect(assets[0]).toEqual({
            providerAssetId: "USDT:trx", providerCode: "USDT", symbol: "USDT", providerNetwork: "trx",
            terms: { fee: "1", minAmount: "10", precision: 6, memoRequired: false, isEnabled: true },
        });
        expect(assets[2].terms.isEnabled).toBe(false);
    });

    it("reads live terms from the quotas endpoint, with memo from the chain info", async () => {
        const http = new FakeKucoinHttp()
            .reply("GET /api/v1/withdrawals/quotas?currency=USDT&chain=bsc", ok({ currency: "USDT", withdrawMinFee: "0.3", withdrawMinSize: "5", precision: 8, isWithdrawEnabled: true }))
            .reply("GET /api/v3/currencies/USDT?chain=bsc", ok(usdtCurrency));
        await expect(kucoin(http).getSendTerms({ providerAssetId: "USDT:bsc" })).resolves.toEqual({ fee: "0.3", minAmount: "5", precision: 8, memoRequired: false, isEnabled: true });
    });

    it("sums the funding account's available balance, 0 when there is none", async () => {
        const http = new FakeKucoinHttp().reply("GET /api/v1/accounts?type=main&currency=USDT", ok([{ currency: "USDT", type: "main", available: "120.5" }, { currency: "USDT", type: "main", available: "0.25" }]));
        await expect(kucoin(http).getBalance({ providerAssetId: "USDT:trx" })).resolves.toBe("120.75");

        const empty = new FakeKucoinHttp().reply("GET /api/v1/accounts?type=main&currency=USDT", ok([]));
        await expect(kucoin(empty).getBalance({ providerAssetId: "USDT:trx" })).resolves.toBe("0");
    });
});
