import createBillCustomerValidation from "@/actions/billCustomerValidation/createBillCustomerValidation";
import selectValidationProduct from "@/actions/billCustomerValidation/createBillCustomerValidation/queries/selectValidationProduct";
import billProviderRegistry from "@/services/bills/billProviderRegistry";
import BillProviderError from "@/services/bills/billProviderError";
import ACTION_FAILURE from "@/constants/actionFailure";
import { makeFakeBillProvider } from "./fakeBillProvider";

jest.mock("@/database", () => ({ db: {} }));
jest.mock("@/actions/billCustomerValidation/createBillCustomerValidation/queries/selectValidationProduct");

const PRODUCT_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("createBillCustomerValidation", () => {
    const originalProvider = process.env.BILLS_PROVIDER;
    const validateCustomer = jest.fn();

    beforeEach(() => {
        jest.resetAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        billProviderRegistry.reset();
        billProviderRegistry.register(makeFakeBillProvider({ validateCustomer }));
        process.env.BILLS_PROVIDER = "fakebills";
        jest.mocked(selectValidationProduct).mockResolvedValue({ providerProductRef: "ref-1", requiresValidation: true });
    });

    afterAll(() => {
        billProviderRegistry.reset();
        if (originalProvider === undefined) delete process.env.BILLS_PROVIDER;
        else process.env.BILLS_PROVIDER = originalProvider;
    });

    const run = () => createBillCustomerValidation({ productId: PRODUCT_ID, customerId: "45067198783" });

    it("asks the active provider with its own product ref", async () => {
        validateCustomer.mockResolvedValue({ customerName: "ADA", address: null, minAmount: null, maxAmount: null });
        await expect(run()).resolves.toEqual({ data: { customerName: "ADA", address: null, minAmount: null, maxAmount: null }, failure: null });
        expect(validateCustomer).toHaveBeenCalledWith({ providerProductRef: "ref-1", customerId: "45067198783" });
    });

    it("skips the provider for billers that don't need validation", async () => {
        jest.mocked(selectValidationProduct).mockResolvedValue({ providerProductRef: "ref-1", requiresValidation: false });
        await expect(run()).resolves.toEqual({ data: { customerName: null, address: null, minAmount: null, maxAmount: null }, failure: null });
        expect(validateCustomer).not.toHaveBeenCalled();
    });

    it.each([
        ["rejected", ACTION_FAILURE.CUSTOMER_NOT_FOUND],
        ["not_found", ACTION_FAILURE.CUSTOMER_NOT_FOUND],
        ["configuration", ACTION_FAILURE.PROVIDER_UNAVAILABLE],
        ["unavailable", ACTION_FAILURE.PROVIDER_UNAVAILABLE],
        ["invalid_response", ACTION_FAILURE.PROVIDER_UNAVAILABLE],
    ] as const)("maps a %s provider error to %s", async (code, failure) => {
        validateCustomer.mockRejectedValue(new BillProviderError({ code, status: 400, providerMessage: "x" }));
        await expect(run()).resolves.toEqual({ data: null, failure });
    });

    it("treats an unexpected error as unavailable, not the user's fault", async () => {
        validateCustomer.mockRejectedValue(new Error("boom"));
        await expect(run()).resolves.toEqual({ data: null, failure: ACTION_FAILURE.PROVIDER_UNAVAILABLE });
    });
});
