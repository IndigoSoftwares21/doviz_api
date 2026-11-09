import BreetProvider from "@/services/crypto/providers/breet/breetProvider";
import { FakeBreetHttp, docsTransaction, fail, fakeClient, ok } from "./breetFakes";

const assets = [
    { id: "67063f653b4a1f6c7a60ec57", name: "Solana Test", identifier: "SOL_TEST", symbol: "SOL", network: "Solana", confirmations: 1, minimum: 5 },
    { id: "a-usdt", name: "USDT Test", identifier: "USDT_TRX_TEST2", symbol: "USDT", network: "Tron", confirmations: 19, minimum: 5 },
];
const provider = (http: FakeBreetHttp) => new BreetProvider({ client: fakeClient(http) });
const wallet = (n: number, label: string) => ({ id: `w${n}`, label, address: `addr${n}`, identifier: "USDT_TRX_TEST2", asset: "a-usdt" });

describe("BreetProvider", () => {
    it("recognises only Breet's dashboard verification ping", () => {
        const breet = provider(new FakeBreetHttp());
        expect(breet.isWebhookPing({ event: "webhook.verification" })).toBe(true);
        expect(breet.isWebhookPing({ event: "trade.completed", eventId: "e1" })).toBe(false);
        expect(breet.isWebhookPing(null)).toBe(false);
    });

    it("generates an address with our label only (no bank / auto-settlement)", async () => {
        const http = new FakeBreetHttp().reply("POST /trades/sell/assets/a-usdt/generate-address", ok({ id: "w1", address: "TV8d" }, 201));
        await expect(provider(http).createDepositAddress({ providerAssetId: "a-usdt", label: "dvz-1" })).resolves.toEqual({
            providerWalletId: "w1",
            address: "TV8d",
        });
        expect(http.requests[0].data).toEqual({ label: "dvz-1" });
    });

    it("reports an existing label as label_exists", async () => {
        const http = new FakeBreetHttp().reply(
            "POST /trades/sell/assets/a-usdt/generate-address",
            fail(400, "TRX_TEST for dvz-1 already exists in your wallets"),
        );
        await expect(provider(http).createDepositAddress({ providerAssetId: "a-usdt", label: "dvz-1" })).rejects.toMatchObject({
            code: "label_exists",
        });
    });

    it("finds a label across pages, matching Breet's merchant prefix but not partial overlaps", async () => {
        const page1 = Array.from({ length: 100 }, (_, i) => wallet(i, `Partner_B-X_dvz-1${i}`));
        const http = new FakeBreetHttp().reply("GET /trades/wallets", ok(page1), ok([wallet(999, "Partner_B-LBNS1M85_dvz-1")]));

        await expect(provider(http).findAddressByLabel({ providerCode: "USDT_TRX_TEST2", label: "dvz-1" })).resolves.toEqual({
            providerWalletId: "w999",
            address: "addr999",
        });
        expect(http.requests.map((request) => request.params?.page)).toEqual([1, 2]);
    });

    it("returns null when the label isn't found", async () => {
        const http = new FakeBreetHttp().reply("GET /trades/wallets", ok([wallet(1, "someone-else")]));
        await expect(provider(http).findAddressByLabel({ providerCode: "USDT_TRX_TEST2", label: "dvz-1" })).resolves.toBeNull();
    });

    it("maps a deposit record to exact strings with the asset's code", async () => {
        const http = new FakeBreetHttp()
            .reply(`GET /trades/transactions/${docsTransaction.id}`, ok(docsTransaction))
            .reply("GET /trades/assets", ok(assets));

        const deposit = await provider(http).getDeposit({ reference: docsTransaction.id });

        expect(deposit).toMatchObject({
            reference: docsTransaction.id,
            providerCode: "SOL_TEST",
            status: "completed",
            cryptoAmount: "0.00025406",
            grossNgn: "20310.45645038847",
            reportedUsd: "21.379427842514175",
            rateNgnPerUsd: "1000",
            amlPassed: true,
        });
    });

    it("returns null for an unknown deposit", async () => {
        const http = new FakeBreetHttp().reply("GET /trades/transactions/nope", fail(404, "transaction not found"));
        await expect(provider(http).getDeposit({ reference: "nope" })).resolves.toBeNull();
    });

    it("quotes naira after Breet's platform fee, rounded down (docs numbers)", async () => {
        const http = new FakeBreetHttp()
            .reply("POST /trades/pbc/sell/rate-calculator/a-usdt", ok({ NGNAmount: 1000, rate: 1000, cryptoAmount: 0.0068731027254410335 }))
            .reply("GET /users/fetch-integration", ok({ platformFeePercent: 1.5 }));

        const quote = await provider(http).getQuote({ providerAssetId: "a-usdt", cryptoAmount: "0.0068731027254410335" });

        expect(quote).toEqual({ grossNgn: "985.00", rateNgnPerUsd: "1000" });
        expect(http.requests[0].data).toEqual({ amountInUSD: 1, currency: "ngn" });
    });

    it("resolves a bank account name", async () => {
        const http = new FakeBreetHttp().reply("POST /payments/banks/validate", ok({ accountName: "OGUNMEPON SHARAFA" }));
        await expect(provider(http).resolveBankAccount({ providerBankId: "39", accountNumber: "3154021148" })).resolves.toEqual({
            accountName: "OGUNMEPON SHARAFA",
        });
        expect(http.requests[0].data).toEqual({ id: "39", accountNumber: "3154021148", currency: "ngn" });
    });
});
