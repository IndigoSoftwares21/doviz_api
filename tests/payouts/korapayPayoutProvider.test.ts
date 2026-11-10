import KorapayClient from "@/services/collections/providers/korapay/korapayClient";
import KorapayPayoutProvider from "@/services/payouts/providers/korapay/korapayPayoutProvider";
import { mapKorapayPayoutStatus } from "@/services/payouts/providers/korapay/mapKorapayPayout";
import { KorapayConfig } from "@/services/collections/providers/korapay/getKorapayConfig";
import { FakeKorapayHttp, TEST_CONFIG, fail, ok } from "../naira-deposits/korapayFakes";

const ID = "0b6c3a3e-1f2d-4c5b-8a9e-2d4f6a8b0c1d";
const payouts = (http: FakeKorapayHttp, config: Partial<KorapayConfig> = {}) =>
    new KorapayPayoutProvider({ client: new KorapayClient({ config: { ...TEST_CONFIG, ...config }, http }) });
const send = (provider: KorapayPayoutProvider, email: string | null = "ada@example.com") =>
    provider.sendPayout({
        externalId: ID, providerBankId: "033", accountNumber: "0000000000", accountName: "OKAFOR ADA",
        amount: { amount: "5000.00", currency: "NGN" }, narration: "Doviz withdrawal", customer: { name: "Ada Okafor", email },
    });

describe("KorapayPayoutProvider", () => {
    it("sends an NGN bank payout with our id as the reference — no beneficiary needed", async () => {
        const http = new FakeKorapayHttp().reply("POST /transactions/disburse", ok({ amount: "5000.00", fee: "15.31", currency: "NGN", status: "processing", reference: ID }));
        const payout = await send(payouts(http));

        expect(http.requests[0].data).toEqual({
            reference: ID, // no notification_url — Korapay's disburse rejects it
            destination: {
                type: "bank_account", amount: 5000, currency: "NGN", narration: "Doviz withdrawal",
                bank_account: { bank: "033", account: "0000000000" }, customer: { name: "Ada Okafor", email: "ada@example.com" },
            },
        });
        expect(http.requests[0].headers.Authorization).toBe(`Bearer ${TEST_CONFIG.secretKey}`);
        expect(payout).toMatchObject({ externalId: ID, status: "pending", fee: { amount: "15.31", currency: "NGN" } });
    });

    it("uses the fallback email for users without one", async () => {
        const http = new FakeKorapayHttp().reply("POST /transactions/disburse", ok({ status: "processing", reference: ID }));
        await send(payouts(http, { fallbackCustomerEmail: "info@fufusoftwareslimited.org" }), null);
        expect((http.requests[0].data as { destination: { customer: { email: string } } }).destination.customer.email).toBe("info@fufusoftwareslimited.org");
    });

    it("on a duplicate reference returns the existing payout instead of failing", async () => {
        const http = new FakeKorapayHttp()
            .reply("POST /transactions/disburse", fail(400, "Duplicate Transaction Reference. Please use a unique reference"))
            .reply(`GET /transactions/${ID}`, ok({ status: "success", amount: 5000, fee: 15.31, currency: "NGN", reference: ID, trace_id: "TRC-1" }));
        await expect(send(payouts(http))).resolves.toMatchObject({ status: "completed", providerReference: "TRC-1", fee: { amount: "15.31" } });
    });

    it("separates a refusal (rejected) from not knowing (unavailable) — Korapay says never treat 5xx as failed", async () => {
        await expect(send(payouts(new FakeKorapayHttp().reply("POST /transactions/disburse", fail(400, "Invalid account."))))).rejects.toMatchObject({ code: "rejected" });
        await expect(send(payouts(new FakeKorapayHttp().reply("POST /transactions/disburse", fail(502, null))))).rejects.toMatchObject({ code: "unavailable" });
        await expect(send(payouts(new FakeKorapayHttp().reply("POST /transactions/disburse", new Error("ETIMEDOUT"))))).rejects.toMatchObject({ code: "unavailable" });
    });

    it("looks a payout up by our reference, and returns null when Korapay has none", async () => {
        const found = new FakeKorapayHttp().reply(`GET /transactions/${ID}`, ok({ status: "failed", message: "Dormant account", amount: 5000, fee: 0, currency: "NGN" }));
        await expect(payouts(found).getPayout({ externalId: ID })).resolves.toMatchObject({ status: "failed", failureReason: "Dormant account" });

        const missing = new FakeKorapayHttp().reply(`GET /transactions/${ID}`, fail(404, "Transaction not found"));
        await expect(payouts(missing).getPayout({ externalId: ID })).resolves.toBeNull();
    });

    it("reads the NGN available balance (verified shape)", async () => {
        const http = new FakeKorapayHttp().reply("GET /balances", ok({ NGN: { pending_balance: 0, available_balance: 6306143.18 }, USD: { available_balance: 5000000 } }));
        await expect(payouts(http).getBalance({ currency: "NGN" })).resolves.toEqual({ amount: "6306143.18", currency: "NGN" });
        await expect(payouts(new FakeKorapayHttp().reply("GET /balances", ok({}))).getBalance({ currency: "NGN" })).resolves.toBeNull();
    });

    it("lists banks with the PUBLIC key, and refuses clearly when it isn't configured", async () => {
        const http = new FakeKorapayHttp().reply("GET /misc/banks?countryCode=NG", ok([{ name: "Guaranty Trust Bank ", slug: "gtbank", code: "058" }]));
        const banks = await payouts(http, { publicKey: "pk_test_public" }).listBanks();
        expect(http.requests[0].headers.Authorization).toBe("Bearer pk_test_public");
        expect(banks).toEqual([{ providerBankId: "058", name: "Guaranty Trust Bank", slug: "gtbank", code: "058" }]);

        await expect(payouts(new FakeKorapayHttp(), { publicKey: null }).listBanks()).rejects.toMatchObject({ code: "configuration" });
    });

    it("resolves the account name (verified shape)", async () => {
        const http = new FakeKorapayHttp().reply("POST /misc/banks/resolve", ok({ bank_name: "United Bank for Africa", bank_code: "033", account_number: "0000000000", account_name: " Test Bank Account - Success " }));
        await expect(payouts(http).resolveAccount({ providerBankId: "033", accountNumber: "0000000000" })).resolves.toEqual({ accountName: "Test Bank Account - Success" });
        expect(http.requests[0].data).toEqual({ bank: "033", account: "0000000000", currency: "NGN" });
    });

    it.each([["success", "completed"], ["SUCCESS", "completed"], ["failed", "failed"], ["processing", "pending"], ["new-word", "pending"], [null, "pending"]])(
        "maps status %p → %s",
        (status, expected) => expect(mapKorapayPayoutStatus({ status })).toBe(expected),
    );
});
