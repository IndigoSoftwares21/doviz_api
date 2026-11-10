import { createHmac } from "crypto";
import CollectionProviderError from "@/services/collections/collectionProviderError";
import KorapayClient from "@/services/collections/providers/korapay/korapayClient";
import getKorapayConfig from "@/services/collections/providers/korapay/getKorapayConfig";
import { FakeKorapayHttp, TEST_CONFIG, fail, fakeKorapay, ok } from "./korapayFakes";

const DEPOSIT_ID = "3b241101-e2bb-4255-8caf-4136c566a962";
const NGN = (amount: string) => ({ amount, currency: "NGN" });
const account = { account_name: "Doviz Checkout", account_number: "9876543210", bank_name: "Wema Bank", bank_code: "035", expiry_date_in_utc: "2026-11-10T13:00:00.000Z" };
const args = (feeBearer: "user" | "doviz") => ({
    externalId: DEPOSIT_ID,
    amount: NGN("50000.00"),
    feeBearer,
    customer: { name: "Ada Obi", email: "ada@example.com" },
    narration: "Doviz wallet top-up",
});

describe("KorapayClient", () => {
    const call = (http: FakeKorapayHttp) => new KorapayClient({ config: TEST_CONFIG, http }).request({ method: "GET", path: `/charges/${DEPOSIT_ID}` });

    it("sends the secret key as a bearer token and unwraps the envelope", async () => {
        const http = new FakeKorapayHttp().reply(`GET /charges/${DEPOSIT_ID}`, ok({ status: "pending" }));
        await expect(call(http)).resolves.toEqual({ status: "pending" });
        expect(http.requests[0].headers.Authorization).toBe(`Bearer ${TEST_CONFIG.secretKey}`);
    });

    it.each([
        [400, "rejected", false],
        [401, "configuration", false],
        [404, "not_found", false],
        [429, "unavailable", true],
        [502, "unavailable", true],
    ])("maps HTTP %i to %s (retryable=%s)", async (status, code, retryable) => {
        const error = await call(new FakeKorapayHttp().reply(`GET /charges/${DEPOSIT_ID}`, fail(status, "nope"))).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(CollectionProviderError);
        expect(error).toMatchObject({ code, status, retryable });
    });

    it("maps a network failure to unavailable and an unknown envelope to invalid_response", async () => {
        await expect(call(new FakeKorapayHttp().reply(`GET /charges/${DEPOSIT_ID}`, new Error("ETIMEDOUT")))).rejects.toMatchObject({ code: "unavailable" });
        await expect(call(new FakeKorapayHttp().reply(`GET /charges/${DEPOSIT_ID}`, { status: 200, data: "<html>" }))).rejects.toMatchObject({ code: "invalid_response" });
    });
});

describe("getKorapayConfig", () => {
    const original = { ...process.env };
    afterEach(() => {
        process.env = { ...original };
    });

    it("refuses a live key in sandbox and a test key in production", () => {
        process.env.KORAPAY_ENV = "sandbox";
        process.env.KORAPAY_SECRET_KEY = "sk_live_abc";
        expect(() => getKorapayConfig()).toThrow(/live key but KORAPAY_ENV is sandbox/);
        process.env.KORAPAY_ENV = "production";
        process.env.KORAPAY_SECRET_KEY = "sk_test_abc";
        expect(() => getKorapayConfig()).toThrow(/test key but KORAPAY_ENV is production/);
    });

    it("builds the charge webhook URL from API_PUBLIC_URL, or leaves it to the dashboard", () => {
        process.env.KORAPAY_ENV = "sandbox";
        process.env.KORAPAY_SECRET_KEY = "sk_test_abc";
        process.env.API_VERSION = "v1";
        process.env.API_PUBLIC_URL = "https://api.doviz.app/";
        expect(getKorapayConfig().webhookUrl).toBe("https://api.doviz.app/api/v1/webhooks/korapay");
        delete process.env.API_PUBLIC_URL;
        expect(getKorapayConfig().webhookUrl).toBeNull();
    });
});

describe("KorapayCollectionProvider.createBankTransfer", () => {
    it("puts the fee on the payer when the user bears it and returns what to send", async () => {
        const http = new FakeKorapayHttp().reply(
            "POST /charges/bank-transfer",
            ok({ reference: DEPOSIT_ID, payment_reference: "KPY-1", amount: 50000, amount_expected: 50375, fee: 350, vat: 25, currency: "NGN", status: "processing", bank_account: account }),
        );

        const created = await fakeKorapay(http).createBankTransfer(args("user"));

        expect(http.requests[0].data).toMatchObject({
            reference: DEPOSIT_ID,
            amount: 50000,
            currency: "NGN",
            merchant_bears_cost: false,
            customer: { email: "ada@example.com", name: "Ada Obi" },
            notification_url: TEST_CONFIG.webhookUrl,
        });
        expect(created).toEqual({
            providerReference: "KPY-1",
            bankAccount: { accountName: "Doviz Checkout", accountNumber: "9876543210", bankName: "Wema Bank" },
            amountToTransfer: NGN("50375.00"),
            fee: NGN("375.00"),
            expiresAt: new Date(account.expiry_date_in_utc),
        });
    });

    it("keeps the amount to send unchanged when Doviz bears the fee", async () => {
        const http = new FakeKorapayHttp().reply(
            "POST /charges/bank-transfer",
            ok({ reference: DEPOSIT_ID, amount: 50000, amount_expected: 50000, fee: 350, vat: 25, currency: "NGN", bank_account: account }),
        );

        const created = await fakeKorapay(http).createBankTransfer(args("doviz"));

        expect(http.requests[0].data).toMatchObject({ merchant_bears_cost: true });
        expect(created.amountToTransfer).toEqual(NGN("50000.00"));
        expect(created.fee).toEqual(NGN("375.00"));
    });

    it("derives the fee from amount_expected when Korapay doesn't itemise it", async () => {
        const http = new FakeKorapayHttp().reply("POST /charges/bank-transfer", ok({ reference: DEPOSIT_ID, amount: 50000, amount_expected: 50400, bank_account: account }));
        const created = await fakeKorapay(http).createBankTransfer(args("user"));
        expect(created.fee).toEqual(NGN("400.00"));
    });

    it("uses the fallback email for a user without one, and refuses without either", async () => {
        const http = new FakeKorapayHttp().reply("POST /charges/bank-transfer", ok({ reference: DEPOSIT_ID, amount_expected: 50375, fee: 375, bank_account: account }));
        await fakeKorapay(http).createBankTransfer({ ...args("user"), customer: { name: null, email: null } });
        expect(http.requests[0].data).toMatchObject({ customer: { email: TEST_CONFIG.fallbackCustomerEmail } });

        await expect(fakeKorapay(new FakeKorapayHttp(), { fallbackCustomerEmail: null }).createBankTransfer({ ...args("user"), customer: { name: null, email: null } }))
            .rejects.toMatchObject({ code: "configuration" });
    });

    it("refuses a charge without an account or expiry", async () => {
        const http = new FakeKorapayHttp().reply("POST /charges/bank-transfer", ok({ reference: DEPOSIT_ID, amount_expected: 50375 }));
        await expect(fakeKorapay(http).createBankTransfer(args("user"))).rejects.toMatchObject({ code: "invalid_response" });
    });
});

describe("KorapayCollectionProvider.getBankTransfer", () => {
    const get = (http: FakeKorapayHttp) => fakeKorapay(http).getBankTransfer({ externalId: DEPOSIT_ID, providerReference: null });

    it("maps a successful charge, gross amount and fee + VAT", async () => {
        const http = new FakeKorapayHttp().reply(
            `GET /charges/${DEPOSIT_ID}`,
            ok({ reference: DEPOSIT_ID, payment_reference: "KPY-1", status: "success", amount: 50000, amount_paid: 50375, fee: 350, vat: 25, currency: "NGN", transaction_date: "2026-11-10T12:10:00.000Z" }),
        );
        await expect(get(http)).resolves.toEqual({
            externalId: DEPOSIT_ID,
            providerReference: "KPY-1",
            status: "completed",
            amountPaid: NGN("50375.00"),
            fee: NGN("375.00"),
            paidAt: new Date("2026-11-10T12:10:00.000Z"),
        });
    });

    it.each([
        ["processing", "pending"],
        ["pending", "pending"],
        ["expired", "expired"],
        ["failed", "failed"],
        ["something-new", "pending"],
    ])("maps Korapay status %s to %s", async (status, expected) => {
        const http = new FakeKorapayHttp().reply(`GET /charges/${DEPOSIT_ID}`, ok({ reference: DEPOSIT_ID, status, amount: 50000 }));
        await expect(get(http)).resolves.toMatchObject({ status: expected, amountPaid: null });
    });

    it("treats an unpaid charge's zero amount_paid and fee as unknown (real sandbox shape)", async () => {
        const http = new FakeKorapayHttp().reply(
            `GET /charges/${DEPOSIT_ID}`,
            ok({ reference: DEPOSIT_ID, status: "processing", amount: "100.00", amount_paid: "0.00", fee: 0, currency: "NGN" }),
        );
        await expect(get(http)).resolves.toMatchObject({ status: "pending", amountPaid: null, fee: null });
    });

    it("returns null when Korapay has no such charge", async () => {
        await expect(get(new FakeKorapayHttp().reply(`GET /charges/${DEPOSIT_ID}`, fail(404, "Charge not found")))).resolves.toBeNull();
    });
});

describe("Korapay webhooks", () => {
    const body = { event: "charge.success", data: { reference: DEPOSIT_ID, currency: "NGN", amount: 50000, fee: 375, status: "success" } };
    const sign = (data: unknown, key = TEST_CONFIG.secretKey) => createHmac("sha256", key).update(JSON.stringify(data)).digest("hex");
    const provider = fakeKorapay(new FakeKorapayHttp());

    it("accepts only an HMAC of `data` made with our secret key", () => {
        expect(provider.verifyWebhook({ headers: { "x-korapay-signature": sign(body.data) }, body, sourceIp: null })).toBe(true);
        expect(provider.verifyWebhook({ headers: { "x-korapay-signature": sign(body.data, "sk_test_other") }, body, sourceIp: null })).toBe(false);
        expect(provider.verifyWebhook({ headers: { "x-korapay-signature": sign(body.data) }, body: { ...body, data: { ...body.data, amount: 1 } }, sourceIp: null })).toBe(false);
        expect(provider.verifyWebhook({ headers: {}, body, sourceIp: null })).toBe(false);
    });

    it("parses a charge event as a naira deposit event keyed by our reference", () => {
        expect(provider.parseWebhook(body)).toEqual({
            eventId: `${DEPOSIT_ID}:charge.success`,
            eventName: "charge.success",
            resourceType: "naira_deposit",
            resourceId: DEPOSIT_ID,
            eventTime: null,
        });
        expect(provider.parseWebhook({ event: "transfer.success", data: { reference: "x" } })).toMatchObject({ resourceType: "other" });
        expect(provider.parseWebhook({ event: "charge.success", data: {} })).toBeNull();
        expect(provider.parseWebhook("nope")).toBeNull();
    });
});
