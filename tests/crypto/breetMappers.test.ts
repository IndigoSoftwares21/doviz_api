import mapBreetAsset from "@/services/crypto/providers/breet/mapBreetAsset";
import mapBreetBank from "@/services/crypto/providers/breet/mapBreetBank";
import mapBreetDeposit from "@/services/crypto/providers/breet/mapBreetDeposit";
import BreetProvider from "@/services/crypto/providers/breet/breetProvider";
import { FakeBreetHttp, docsTransaction, fakeClient, ok } from "./breetFakes";

describe("Breet mappers", () => {
    // Real rows from Breet's sandbox /trades/assets.
    it.each([
        [{ symbol: "USDT", network: "Tron", type: "TRON_TRC20" }, "TRC20"],
        [{ symbol: "USDC", network: "Ethereum", type: "ERC20" }, "ERC20"],
        [{ symbol: "USDT", network: "Ethereum", type: "ERC20" }, "ERC20"],
        [{ symbol: "BTC", network: "Bitcoin", type: "BASE_ASSET" }, "BITCOIN"],
        [{ symbol: "ETH", network: "Ethereum", type: "BASE_ASSET" }, "ETHEREUM"],
        [{ symbol: "ETH", network: "Ethereum_Sepolia", type: "BASE_ASSET" }, "ETHEREUM"],
        // ERC20-standard tokens on other EVM chains must NOT pass as ERC20.
        [{ symbol: "USDC", network: "Arbitrum", type: "ERC20" }, "ARBITRUM"],
        [{ symbol: "USDC", network: "Polygon", type: "ERC20" }, "POLYGON"],
        [{ symbol: "USDT", network: "Polygon", type: "ERC20" }, "POLYGON"],
        [{ symbol: "USDC", network: "Base", type: "BASE" }, "BASE"],
        [{ symbol: "USDC", network: "Binance_Smart_Chain", type: "BEP20" }, "BINANCE_SMART_CHAIN"],
        [{ symbol: "USDT", network: "TON", type: "JETTON" }, "TON"],
        [{ symbol: "BCH", network: "Bitcoin_Cash", type: "BASE_ASSET" }, "BITCOIN_CASH"],
        [{ symbol: "TRX", network: "Tron", type: "BASE_ASSET" }, "TRON"],
        // Unknown kind fails closed: never one of ours.
        [{ symbol: "USDT", network: "Tron" }, "TRON"],
        [{ symbol: "USDC", network: "Ethereum" }, "ETHEREUM"],
    ])("maps %p to network %s", (fields, network) => {
        const asset = mapBreetAsset({ asset: { id: "x", name: "n", identifier: "ID", minimum: 5, confirmations: 3, ...fields } });
        expect(asset.network).toBe(network);
        expect(asset.minDeposit).toBeNull(); // Breet's `minimum` is USD — coin minimums come from getMinDeposit
    });

    it("maps a bank to a neutral slug and no fake CBN code", () => {
        const bank = mapBreetBank({ bank: { id: "39", name: " United Bank For Africa ", slug: "United_Bank-For Africa" } });
        expect(bank).toEqual({ providerBankId: "39", name: "United Bank For Africa", slug: "united-bank-for-africa", code: null });
        expect(mapBreetBank({ bank: { id: "1", name: "GTBank Plc." } }).slug).toBe("gtbank-plc");
    });

    it.each([
        ["completed", "completed"],
        ["flagged", "flagged"],
        ["deleted", "deleted"],
        ["pending", "pending"],
        ["something-new", "pending"],
    ])("maps status %s → %s (unknown never credits)", (status, expected) => {
        expect(mapBreetDeposit({ transaction: { ...docsTransaction, status }, providerCode: "SOL_TEST" }).status).toBe(expected);
    });

    it("only reports naira when Breet settled in NGN", () => {
        const usd = mapBreetDeposit({ transaction: { ...docsTransaction, currency: "usd" }, providerCode: "SOL_TEST" });
        expect(usd.grossNgn).toBeNull();
        expect(usd.cryptoAmount).toBe("0.00025406");
    });

    it("keeps numbers exact as strings (no float noise)", () => {
        const deposit = mapBreetDeposit({ transaction: { ...docsTransaction, amount: 0.1 + 0.2 }, providerCode: "SOL_TEST" });
        expect(typeof deposit.grossNgn).toBe("string");
        expect(deposit.grossNgn).toBe(String(0.1 + 0.2));
    });
});

describe("listRecentDeposits", () => {
    it("pages until records are older than `since`", async () => {
        const recent = Array.from({ length: 100 }, (_, i) => ({ ...docsTransaction, id: `t${i}`, updatedAt: "2026-01-02T00:00:00Z" }));
        const old = [{ ...docsTransaction, id: "old", updatedAt: "2025-01-01T00:00:00Z" }];
        const http = new FakeBreetHttp().reply("GET /trades/transactions", ok(recent), ok(old)).reply("GET /trades/assets", ok([]));

        const deposits = await new BreetProvider({ client: fakeClient(http) }).listRecentDeposits({ since: new Date("2026-01-01T00:00:00Z") });

        expect(deposits).toHaveLength(100);
        expect(deposits.every((deposit) => deposit.reference !== "old")).toBe(true);
    });
});
