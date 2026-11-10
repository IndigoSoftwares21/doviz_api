import BillProviderError from "@/services/bills/billProviderError";
import FlutterwaveClient from "@/services/bills/providers/flutterwave/flutterwaveClient";
import getFlutterwaveConfig from "@/services/bills/providers/flutterwave/getFlutterwaveConfig";
import mapFlutterwaveBillStatus from "@/services/bills/providers/flutterwave/mapFlutterwaveBillStatus";
import catalogFixture from "./fixtures/flutterwaveBillCategories.json";
import { FakeFlutterwaveHttp, TEST_CONFIG, fail, fakeProvider, ok } from "./flutterwaveFakes";

const NGN = (amount: string) => ({ amount, currency: "NGN" });

describe("FlutterwaveClient", () => {
    const call = (http: FakeFlutterwaveHttp) =>
        new FlutterwaveClient({ config: TEST_CONFIG, http }).request({ method: "GET", path: "/bill-categories" });

    it("sends the secret key as a bearer token and unwraps the envelope", async () => {
        const http = new FakeFlutterwaveHttp().reply("GET /bill-categories", ok([{ id: 1 }]));
        await expect(call(http)).resolves.toEqual([{ id: 1 }]);
        expect(http.requests[0].headers.Authorization).toBe(`Bearer ${TEST_CONFIG.secretKey}`);
    });

    it.each([
        [400, "rejected", false],
        [401, "configuration", false],
        [403, "configuration", false],
        [404, "not_found", false],
        [429, "unavailable", true],
        [500, "unavailable", true],
        [503, "unavailable", true],
    ])("maps HTTP %i to %s (retryable=%s)", async (status, code, retryable) => {
        const error = await call(new FakeFlutterwaveHttp().reply("GET /bill-categories", fail(status, "nope"))).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(BillProviderError);
        expect(error).toMatchObject({ code, status, retryable, providerMessage: "nope" });
    });

    it("treats a 200 with status error as rejected, and an unknown envelope as unreadable", async () => {
        await expect(call(new FakeFlutterwaveHttp().reply("GET /bill-categories", { status: 200, data: { status: "error", message: "bad" } })))
            .rejects.toMatchObject({ code: "rejected", providerMessage: "bad" });
        await expect(call(new FakeFlutterwaveHttp().reply("GET /bill-categories", { status: 200, data: "<html>" })))
            .rejects.toMatchObject({ code: "invalid_response", retryable: true });
    });

    it("maps a network failure or timeout to unavailable (outcome unknown)", async () => {
        await expect(call(new FakeFlutterwaveHttp().reply("GET /bill-categories", new Error("ETIMEDOUT"))))
            .rejects.toMatchObject({ code: "unavailable", retryable: true, status: null });
    });

    it("never logs the secret key", async () => {
        const lines: string[] = [];
        const spies = (["info", "warn", "error", "log"] as const).map((level) =>
            jest.spyOn(console, level).mockImplementation((...args: unknown[]) => void lines.push(JSON.stringify(args))),
        );
        await call(new FakeFlutterwaveHttp().reply("GET /bill-categories", fail(500, "boom"))).catch(() => undefined);
        spies.forEach((spy) => spy.mockRestore());
        expect(lines.join("\n")).not.toContain(TEST_CONFIG.secretKey);
    });
});

describe("getFlutterwaveConfig", () => {
    const original = { ...process.env };
    afterEach(() => {
        process.env = { ...original };
    });

    it("refuses a live key in sandbox and a test key in production", () => {
        process.env.FLUTTERWAVE_ENV = "sandbox";
        process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK-live-key";
        expect(() => getFlutterwaveConfig()).toThrow("is a live key but FLUTTERWAVE_ENV is sandbox");

        process.env.FLUTTERWAVE_ENV = "production";
        process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_TEST-key";
        expect(() => getFlutterwaveConfig()).toThrow("is a test key but FLUTTERWAVE_ENV is production");
    });
});

describe("FlutterwaveBillProvider.listCatalog (recorded sandbox response)", () => {
    const load = async () => {
        const http = new FakeFlutterwaveHttp().reply("GET /bill-categories", { status: 200, data: catalogFixture });
        const catalog = await fakeProvider(http).listCatalog();
        return { catalog, http };
    };

    it("asks for Nigerian bills only", async () => {
        const { http } = await load();
        expect(http.requests[0].params).toEqual({ country: "NG" });
    });

    it("keys products by biller AND item code, since item codes repeat across billers", async () => {
        const { catalog } = await load();
        const refs = catalog.products.map((product) => product.providerProductRef);
        expect(refs).toEqual(expect.arrayContaining(["BIL113:UB160", "BIL118:UB160"]));
        expect(new Set(refs).size).toBe(refs.length);
    });

    it("collapses Flutterwave's repeated items, keeping the newest", async () => {
        const { catalog } = await load();
        const dstvPremium = catalog.products.filter((product) => product.providerProductRef === "BIL119:CB140");
        expect(dstvPremium).toHaveLength(1);
        expect(dstvPremium[0]).toMatchObject({ name: "DSTV Premium", amountType: "fixed", price: "14600.00", currency: "NGN" });
        expect(catalog.products.filter((product) => product.providerProductRef === "BIL104:MD107")).toHaveLength(1);
    });

    it("treats amount 0 as any-amount and passes names through raw", async () => {
        const { catalog } = await load();
        expect(catalog.products.find((product) => product.providerProductRef === "BIL113:UB159")).toMatchObject({
            name: "IKEDC  PREPAID",
            amountType: "range",
            price: null,
            minAmount: null,
        });
    });

    it("states the category only when Flutterwave does (airtime)", async () => {
        const { catalog } = await load();
        const byRef = Object.fromEntries(catalog.billers.map((biller) => [biller.providerBillerRef, biller]));
        expect(byRef.BIL099).toMatchObject({ name: "MTN VTU", categoryHint: "airtime", customerIdLabel: "Mobile Number" });
        expect(byRef.BIL102.categoryHint).toBe("airtime");
        expect(byRef.BIL104.categoryHint).toBeNull();
        expect(byRef.BIL122.name).toBe("FIRS PAYMENT"); // reported raw; the shared sync decides it's not ours
    });
});

describe("FlutterwaveBillProvider payments", () => {
    const externalId = "0b6c3a3e-1f2d-4c5b-8a9e-2d4f6a8b0c1d";
    const payPath = "POST /billers/BIL099/items/AT099/payment";

    it("pays with our id as the reference and reports pending until confirmed", async () => {
        const http = new FakeFlutterwaveHttp().reply(payPath, ok({ tx_ref: "CF-FLYAPI-1", amount: 100, recharge_token: null }));
        const payment = await fakeProvider(http).payBill({ externalId, providerProductRef: "BIL099:AT099", customerId: "08038291822", amount: NGN("100.00") });

        expect(http.requests[0].data).toEqual({ country: "NG", customer_id: "08038291822", amount: 100, reference: externalId });
        expect(payment).toMatchObject({ externalId, providerReference: "CF-FLYAPI-1", status: "pending", token: null });
    });

    it("on a duplicate reference returns the existing payment instead of failing", async () => {
        const http = new FakeFlutterwaveHttp()
            .reply(payPath, fail(400, "Duplicate transaction reference"))
            .reply(`GET /bills/${externalId}`, ok({ tx_ref: "CF-FLYAPI-1", status: "successful", amount: "100.0000", fee: 0 }));
        const payment = await fakeProvider(http).payBill({ externalId, providerProductRef: "BIL099:AT099", customerId: "08038291822", amount: NGN("100.00") });

        expect(payment).toMatchObject({ status: "completed", providerReference: "CF-FLYAPI-1", amount: NGN("100.00") });
    });

    it("separates a refusal (rejected), our setup (configuration) and a timeout (unavailable)", async () => {
        const refused = new FakeFlutterwaveHttp().reply(payPath, fail(400, "Amount must be 1900.0"));
        await expect(fakeProvider(refused).payBill({ externalId, providerProductRef: "BIL099:AT099", customerId: "080", amount: NGN("100.00") }))
            .rejects.toMatchObject({ code: "rejected" });

        const unknownBiller = new FakeFlutterwaveHttp().reply(payPath, fail(400, "Unknown biller"));
        await expect(fakeProvider(unknownBiller).payBill({ externalId, providerProductRef: "BIL099:AT099", customerId: "080", amount: NGN("100.00") }))
            .rejects.toMatchObject({ code: "configuration" });

        const notWhitelisted = new FakeFlutterwaveHttp().reply(payPath, fail(400, "Please enable IP Whitelisting to access this service"));
        await expect(fakeProvider(notWhitelisted).payBill({ externalId, providerProductRef: "BIL099:AT099", customerId: "080", amount: NGN("100.00") }))
            .rejects.toMatchObject({ code: "configuration", retryable: false });

        const timedOut = new FakeFlutterwaveHttp().reply(payPath, new Error("ETIMEDOUT"));
        await expect(fakeProvider(timedOut).payBill({ externalId, providerProductRef: "BIL099:AT099", customerId: "080", amount: NGN("100.00") }))
            .rejects.toMatchObject({ code: "unavailable" });
    });

    it("refuses a currency Flutterwave bills can't pay", async () => {
        await expect(fakeProvider(new FakeFlutterwaveHttp()).payBill({ externalId, providerProductRef: "BIL099:AT099", customerId: "080", amount: { amount: "10.00", currency: "GHS" } }))
            .rejects.toMatchObject({ code: "rejected", providerMessage: "Currency GHS not supported" });
    });

    it("reads the electricity token and cost from the status record", async () => {
        const http = new FakeFlutterwaveHttp().reply(
            "GET /bills/CF-FLYAPI-2",
            ok({ tx_ref: "CF-FLYAPI-2", status: "success", amount: "24900.00", fee: 100, commission: 30, extra: "TOKEN1147XXXX5707123" }),
        );
        const payment = await fakeProvider(http).getBillPayment({ externalId, providerReference: "CF-FLYAPI-2" });

        expect(payment).toMatchObject({ status: "completed", token: "TOKEN1147XXXX5707123", amount: NGN("24900.00"), cost: NGN("25000.00") });
        expect(http.requests[0].params).toEqual({ verbose: 1 });
    });

    it("falls back to our reference, and returns null when Flutterwave has no record", async () => {
        const http = new FakeFlutterwaveHttp()
            .reply("GET /bills/CF-unknown", fail(404, "Transaction not found"))
            .reply(`GET /bills/${externalId}`, fail(400, "Transaction not found"));
        await expect(fakeProvider(http).getBillPayment({ externalId, providerReference: "CF-unknown" })).resolves.toBeNull();
        expect(http.requests.map((request) => request.url)).toEqual(["/bills/CF-unknown", `/bills/${externalId}`]);
    });

    it("validates a customer by item and biller code", async () => {
        const http = new FakeFlutterwaveHttp().reply(
            "GET /bill-items/UB159/validate",
            ok({ response_code: "00", name: " ADEBAYO OLUWASEUN ", address: "12 Allen Ave", minimum: 1000, maximum: 500000 }),
        );
        const customer = await fakeProvider(http).validateCustomer({ providerProductRef: "BIL113:UB159", customerId: "45067198783" });

        expect(http.requests[0].params).toEqual({ code: "BIL113", customer: "45067198783" });
        expect(customer).toEqual({ customerName: "ADEBAYO OLUWASEUN", address: "12 Allen Ave", minAmount: "1000.00", maxAmount: "500000.00" });
    });

    it("rejects a customer Flutterwave can't find", async () => {
        const http = new FakeFlutterwaveHttp().reply("GET /bill-items/UB159/validate", ok({ response_code: "56", response_message: "Invalid meter" }));
        await expect(fakeProvider(http).validateCustomer({ providerProductRef: "BIL113:UB159", customerId: "1" }))
            .rejects.toMatchObject({ code: "rejected", providerMessage: "Invalid meter" });
    });
});

describe("mapFlutterwaveBillStatus", () => {
    it.each([
        ["success", "completed"],
        ["successful", "completed"],
        ["SUCCESSFUL", "completed"],
        ["failed", "failed"],
        ["pending", "pending"],
        ["something-new", "pending"],
        [null, "pending"],
    ])("%s → %s", (status, expected) => {
        expect(mapFlutterwaveBillStatus({ status })).toBe(expected);
    });
});
