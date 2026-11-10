import { BillProvider } from "@/services/bills/billProvider";
import { ProviderBillPayment } from "@/services/bills/types";
import { PROVIDER_ENVIRONMENT } from "@/constants/crypto";
import { PROVIDER_BILL_STATUS } from "@/constants/bills";

/** A bill provider double: proves the core never depends on a specific provider. */
export const makeFakeBillProvider = (overrides: Partial<BillProvider> = {}): BillProvider => ({
    name: "fakebills",
    environment: PROVIDER_ENVIRONMENT.SANDBOX,
    listCatalog: jest.fn().mockResolvedValue({ billers: [], products: [] }),
    validateCustomer: jest.fn(),
    payBill: jest.fn(),
    getBillPayment: jest.fn().mockResolvedValue(null),
    verifyWebhook: jest.fn().mockReturnValue(true),
    parseWebhook: jest.fn().mockReturnValue(null),
    isWebhookPing: jest.fn().mockReturnValue(false),
    ...overrides,
});

export const billPaymentRecord = (overrides: Partial<ProviderBillPayment> = {}): ProviderBillPayment => ({
    externalId: "6f1c2a52-6a0e-4f5b-9a57-2f5f1d0c9b10",
    providerReference: "fake-ref-1",
    status: PROVIDER_BILL_STATUS.PENDING,
    amount: { amount: "2000.00", currency: "NGN" },
    cost: null,
    token: null,
    failureReason: null,
    ...overrides,
});
