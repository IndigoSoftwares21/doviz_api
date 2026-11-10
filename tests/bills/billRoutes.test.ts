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

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

const BILLER_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const PRODUCT_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

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
        const product = { id: PRODUCT_ID, name: "1.5GB", amountType: "fixed", currency: "NGN", price: "1000.00", minAmount: null, maxAmount: null, serviceFee: "0.00", validityDays: 30 };
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
            jest.mocked(selectListableBillProduct).mockResolvedValue({ id: PRODUCT_ID, customerIdLabel: "Meter number", customerIdPattern: "^[0-9]{6,20}$" });
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
});
