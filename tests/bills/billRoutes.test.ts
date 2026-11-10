import express from "express";
import request from "supertest";
import billRoutes from "@/routes/bill.routes";
import signAccessToken from "@/utils/auth/signAccessToken";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import selectListableBiller from "@/schemaHelpers/selectListableBiller";
import selectListableBillProduct from "@/schemaHelpers/selectListableBillProduct";
import fetchBillCategories from "@/actions/billCategories/fetchBillCategories";
import fetchBillers from "@/actions/billers/fetchBillers";
import fetchBillProducts from "@/actions/billProducts/fetchBillProducts";
import createBillCustomerValidation from "@/actions/billCustomerValidation/createBillCustomerValidation";
import createBillPayment from "@/actions/billPayment/createBillPayment";
import fetchBillPayment from "@/actions/billPayment/fetchBillPayment";
import fetchBillPayments from "@/actions/billPayments/fetchBillPayments";
import billProviderRegistry from "@/services/bills/billProviderRegistry";
import ACTION_FAILURE from "@/constants/actionFailure";
import { makeFakeBillProvider } from "./fakeBillProvider";

jest.mock("@/database", () => ({ db: {}, withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/schemaHelpers/selectListableBiller");
jest.mock("@/schemaHelpers/selectListableBillProduct");
jest.mock("@/actions/billCategories/fetchBillCategories");
jest.mock("@/actions/billers/fetchBillers");
jest.mock("@/actions/billProducts/fetchBillProducts");
jest.mock("@/actions/billCustomerValidation/createBillCustomerValidation");
jest.mock("@/actions/billPayment/createBillPayment");
jest.mock("@/actions/billPayment/fetchBillPayment");
jest.mock("@/actions/billPayments/fetchBillPayments");

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

const BILLER_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const PRODUCT_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const KEY = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const meterProduct = {
    id: PRODUCT_ID, amountType: "range", currency: "NGN", price: null, minAmount: "500.00", maxAmount: "500000.00",
    customerIdLabel: "Meter number", customerIdPattern: "^[0-9]{6,20}$",
};
const bundleProduct = {
    id: PRODUCT_ID, amountType: "fixed", currency: "NGN", price: "1000.00", minAmount: null, maxAmount: null,
    customerIdLabel: "Phone number", customerIdPattern: "^0[789][01][0-9]{8}$",
};
const verified = { status: "verified" as const };
const paymentView = {
    id: "5f0a3c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b", status: "pending", biller: { id: BILLER_ID, name: "MTN", category: "data", logoUrl: null },
    product: { id: PRODUCT_ID, name: "1GB" }, customerId: "08038291822", customerName: null, currency: "NGN",
    amount: "1000.00", serviceFee: "0.00", total: "1000.00", token: null, failureReason: null, createdAt: "2026-11-10T12:00:00.000Z", completedAt: null,
};

const app = express();
app.use(express.json());
app.use("/api/v1/app/bills", billRoutes);

const auth = () => `Bearer ${signAccessToken({ userId: "user-1", sessionId: "session-1" })}`;
const get = (path: string) => request(app).get(`/api/v1/app/bills${path}`).set("Authorization", auth());
const post = (path: string, body: object) => request(app).post(`/api/v1/app/bills${path}`).set("Authorization", auth()).send(body);

describe("bill routes", () => {
    const originalProvider = process.env.BILLS_PROVIDER;

    beforeEach(() => {
        jest.resetAllMocks();
        billProviderRegistry.reset();
        billProviderRegistry.register(makeFakeBillProvider());
        process.env.BILLS_PROVIDER = "fakebills";
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "d-1", accountStatus: "active" });
    });

    afterAll(() => {
        billProviderRegistry.reset();
        if (originalProvider === undefined) delete process.env.BILLS_PROVIDER;
        else process.env.BILLS_PROVIDER = originalProvider;
    });

    it("requires a signed-in user", async () => {
        const response = await request(app).get("/api/v1/app/bills/categories");
        expect(response.status).toBe(401);
        expect(fetchBillCategories).not.toHaveBeenCalled();
    });

    it("lists categories", async () => {
        jest.mocked(fetchBillCategories).mockResolvedValue({ data: [{ code: "airtime", name: "Airtime" }] });
        const response = await get("/categories");
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([{ code: "airtime", name: "Airtime" }]);
    });

    it("lists billers, filtered by a case-insensitive category", async () => {
        jest.mocked(fetchBillers).mockResolvedValue({ data: [] });
        const response = await get("/billers?category=Electricity");
        expect(response.status).toBe(200);
        expect(fetchBillers).toHaveBeenCalledWith({ category: "electricity" });
    });

    it("rejects an unknown category", async () => {
        const response = await get("/billers?category=gambling");
        expect(response.status).toBe(400);
        expect(response.body.validationErrors[0].path).toEqual(["category"]);
        expect(fetchBillers).not.toHaveBeenCalled();
    });

    it("lists a biller's products", async () => {
        jest.mocked(selectListableBiller).mockResolvedValue({ id: BILLER_ID });
        const product = { id: PRODUCT_ID, name: "1.5GB", amountType: "fixed", currency: "NGN", price: "1000.00", minAmount: null, maxAmount: null, serviceFee: "0.00", validityDays: 30, validityGroup: "monthly" as const };
        jest.mocked(fetchBillProducts).mockResolvedValue({ data: [product] });

        const response = await get(`/billers/${BILLER_ID}/products`);
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([product]);
        expect(selectListableBiller).toHaveBeenCalledWith({ billerId: BILLER_ID, provider: "fakebills", environment: "sandbox" });
    });

    it("refuses products for a biller that isn't available", async () => {
        jest.mocked(selectListableBiller).mockResolvedValue(undefined);
        const response = await get(`/billers/${BILLER_ID}/products`);
        expect(response.status).toBe(400);
        expect(response.body.validationErrors[0]).toEqual({ path: ["billerId"], message: "This biller isn't available" });
        expect(fetchBillProducts).not.toHaveBeenCalled();
    });

    describe("POST /validate", () => {
        beforeEach(() => {
            jest.mocked(selectListableBillProduct).mockResolvedValue(meterProduct);
        });

        it("returns the name on the meter, after dropping spaces and dashes", async () => {
            const customer = { customerName: "ADEBAYO OLUWASEUN", address: "12 Allen Ave", minAmount: "1000.00", maxAmount: "500000.00" };
            jest.mocked(createBillCustomerValidation).mockResolvedValue({ data: customer, failure: null });

            const response = await post("/validate", { productId: PRODUCT_ID, customerId: "4506-7198 783" });
            expect(response.status).toBe(200);
            expect(response.body.data).toEqual(customer);
            expect(createBillCustomerValidation).toHaveBeenCalledWith({ productId: PRODUCT_ID, customerId: "45067198783" });
        });

        it("checks the number against the biller's pattern before calling the provider", async () => {
            const response = await post("/validate", { productId: PRODUCT_ID, customerId: "ABC123" });
            expect(response.status).toBe(400);
            expect(response.body.validationErrors).toEqual([{ path: ["customerId"], message: "Enter a valid meter number" }]);
            expect(createBillCustomerValidation).not.toHaveBeenCalled();
        });

        it("reports a malformed number once, without a second pattern error", async () => {
            const response = await post("/validate", { productId: PRODUCT_ID, customerId: "ab" });
            expect(response.status).toBe(400);
            expect(response.body.validationErrors).toEqual([{ path: ["customerId"], message: "Customer number is too short" }]);
        });

        it("refuses a product that isn't available", async () => {
            jest.mocked(selectListableBillProduct).mockResolvedValue(undefined);
            const response = await post("/validate", { productId: PRODUCT_ID, customerId: "45067198783" });
            expect(response.status).toBe(400);
            expect(response.body.validationErrors[0].path).toEqual(["productId"]);
        });

        it("tells the user when the customer number doesn't exist", async () => {
            jest.mocked(createBillCustomerValidation).mockResolvedValue({ data: null, failure: ACTION_FAILURE.CUSTOMER_NOT_FOUND });
            const response = await post("/validate", { productId: PRODUCT_ID, customerId: "45067198783" });
            expect(response.status).toBe(400);
            expect(response.body.message).toBe("We couldn't find this customer number. Check it and try again.");
        });

        it("answers 503 (not the user's fault) when the provider can't be used", async () => {
            jest.mocked(createBillCustomerValidation).mockResolvedValue({ data: null, failure: ACTION_FAILURE.PROVIDER_UNAVAILABLE });
            const response = await post("/validate", { productId: PRODUCT_ID, customerId: "45067198783" });
            expect(response.status).toBe(503);
            expect(response.body.message).toMatch(/temporarily unavailable/);
        });
    });

    describe("POST /payments", () => {
        const pay = (body: object) => post("/payments", { customerId: "08038291822", idempotencyKey: KEY, pin: "4827", productId: PRODUCT_ID, ...body });

        it("pays a fixed-price bundle without an amount and returns 201", async () => {
            jest.mocked(selectListableBillProduct).mockResolvedValue(bundleProduct);
            jest.mocked(createBillPayment).mockResolvedValue({ data: paymentView, failure: null, verification: verified, isNew: true } as never);

            const response = await pay({ customerId: "0803 829 1822" });
            expect(response.status).toBe(201);
            expect(response.body.data).toEqual(paymentView);
            expect(createBillPayment).toHaveBeenCalledWith(expect.objectContaining({
                userId: "user-1", productId: PRODUCT_ID, customerId: "08038291822", amount: null, idempotencyKey: KEY, pin: "4827",
            }));
        });

        it("returns the original payment with 200 for a reused idempotency key", async () => {
            jest.mocked(selectListableBillProduct).mockResolvedValue(bundleProduct);
            jest.mocked(createBillPayment).mockResolvedValue({ data: paymentView, failure: null, verification: verified, isNew: false } as never);
            const response = await pay({});
            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Bill payment already submitted");
        });

        it("refuses a wrong price for a fixed plan", async () => {
            jest.mocked(selectListableBillProduct).mockResolvedValue(bundleProduct);
            const response = await pay({ amount: "900.00" });
            expect(response.status).toBe(400);
            expect(response.body.validationErrors).toEqual([{ path: ["amount"], message: "This plan costs 1000.00" }]);
            expect(createBillPayment).not.toHaveBeenCalled();
        });

        it.each([
            [undefined, "Amount is required"],
            ["100.00", "Minimum is 500.00"],
            ["600000.00", "Maximum is 500000.00"],
        ])("checks an any-amount product's amount (%s)", async (amount, message) => {
            jest.mocked(selectListableBillProduct).mockResolvedValue(meterProduct);
            const response = await pay({ customerId: "45067198783", amount });
            expect(response.status).toBe(400);
            expect(response.body.validationErrors).toEqual([{ path: ["amount"], message }]);
        });

        it("rejects malformed amounts and a missing idempotency key", async () => {
            jest.mocked(selectListableBillProduct).mockResolvedValue(meterProduct);
            const response = await pay({ customerId: "45067198783", amount: "5000.001", idempotencyKey: "abc" });
            expect(response.status).toBe(400);
            expect(response.body.validationErrors.map((error: { path: string[] }) => error.path[0]).sort()).toEqual(["amount", "idempotencyKey"]);
        });

        it.each([
            ["customer_not_found", 400, "We couldn't find this customer number. Check it and try again."],
            ["provider_unavailable", 503, "Bill payments are temporarily unavailable. Please try again shortly."],
        ])("reports a %s customer check as %i", async (failure, status, message) => {
            jest.mocked(selectListableBillProduct).mockResolvedValue(meterProduct);
            jest.mocked(createBillPayment).mockResolvedValue({ data: null, failure, verification: verified, isNew: false, limits: null } as never);
            const response = await pay({ customerId: "45067198783", amount: "1000.00" });
            expect(response.status).toBe(status);
            expect(response.body.message).toBe(message);
        });

        it("explains the meter's own limits", async () => {
            jest.mocked(selectListableBillProduct).mockResolvedValue(meterProduct);
            jest.mocked(createBillPayment).mockResolvedValue({
                data: null, failure: ACTION_FAILURE.AMOUNT_OUT_OF_RANGE, verification: verified, isNew: false, limits: { minAmount: "1500.00", maxAmount: null },
            } as never);
            const response = await pay({ customerId: "45067198783", amount: "1000.00" });
            expect(response.status).toBe(400);
            expect(response.body.message).toBe("For this customer the amount must be at least ₦1,500.00");
        });

        it("answers 402 when the balance doesn't cover it", async () => {
            jest.mocked(selectListableBillProduct).mockResolvedValue(bundleProduct);
            jest.mocked(createBillPayment).mockResolvedValue({ data: null, failure: ACTION_FAILURE.INSUFFICIENT_BALANCE, verification: verified, isNew: false } as never);
            const response = await pay({});
            expect(response.status).toBe(402);
            expect(response.body.message).toBe("You don't have enough balance for this payment");
        });

        it("reports a wrong PIN with attempts left, and a locked PIN as 423", async () => {
            jest.mocked(selectListableBillProduct).mockResolvedValue(bundleProduct);
            jest.mocked(createBillPayment).mockResolvedValue({ data: null, failure: ACTION_FAILURE.PIN, verification: { status: "invalid", remainingAttempts: 2 }, isNew: false } as never);
            const wrong = await pay({});
            expect(wrong.status).toBe(400);
            expect(wrong.body.message).toMatch(/2 attempts remaining/);

            jest.mocked(createBillPayment).mockResolvedValue({ data: null, failure: ACTION_FAILURE.PIN, verification: { status: "locked", lockedUntil: new Date() }, isNew: false } as never);
            expect((await pay({})).status).toBe(423);
        });
    });

    describe("GET /payments", () => {
        it("returns one payment as we have it (no provider call)", async () => {
            jest.mocked(fetchBillPayment).mockResolvedValue({ data: paymentView } as never);
            const response = await get(`/payments/${paymentView.id}`);
            expect(response.status).toBe(200);
            expect(fetchBillPayment).toHaveBeenCalledWith({ userId: "user-1", billPaymentId: paymentView.id });
        });

        it("404s for a payment that isn't the user's", async () => {
            jest.mocked(fetchBillPayment).mockResolvedValue({ data: null });
            expect((await get(`/payments/${paymentView.id}`)).status).toBe(404);
        });

        it("pages the history", async () => {
            jest.mocked(fetchBillPayments).mockResolvedValue({ data: { items: [], limit: 10, offset: 20, hasMore: false } } as never);
            const response = await get("/payments?limit=10&offset=20");
            expect(response.status).toBe(200);
            expect(fetchBillPayments).toHaveBeenCalledWith({ userId: "user-1", limit: 10, offset: 20 });
            expect((await get("/payments?limit=500")).status).toBe(400);
        });
    });
});
