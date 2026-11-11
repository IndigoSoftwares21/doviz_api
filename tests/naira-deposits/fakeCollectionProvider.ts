import { CollectionProvider } from "@/services/collections/collectionProvider";
import { ProviderBankTransfer, ProviderBankTransferCreated } from "@/services/collections/types";
import { PROVIDER_ENVIRONMENT } from "@/constants/crypto";
import { PROVIDER_TRANSFER_STATUS } from "@/constants/nairaDeposits";

/** A collection provider double: proves the core never depends on a specific provider. */
export const makeFakeCollectionProvider = (overrides: Partial<CollectionProvider> = {}): CollectionProvider => ({
    name: "fakecollect",
    environment: PROVIDER_ENVIRONMENT.SANDBOX,
    createBankTransfer: jest.fn(),
    getBankTransfer: jest.fn().mockResolvedValue(null),
    verifyWebhook: jest.fn().mockReturnValue(true),
    parseWebhook: jest.fn().mockReturnValue(null),
    isWebhookPing: jest.fn().mockReturnValue(false),
    ...overrides,
});

export const bankTransferCreated = (overrides: Partial<ProviderBankTransferCreated> = {}): ProviderBankTransferCreated => ({
    providerReference: "fake-ref-1",
    bankAccount: { accountName: "Doviz Checkout", accountNumber: "9876543210", bankName: "Test Bank" },
    amountToTransfer: { amount: "50375.00", currency: "NGN" },
    fee: { amount: "375.00", currency: "NGN" },
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    ...overrides,
});

export const bankTransferRecord = (overrides: Partial<ProviderBankTransfer> = {}): ProviderBankTransfer => ({
    externalId: "3b241101-e2bb-4255-8caf-4136c566a962",
    providerReference: "fake-ref-1",
    status: PROVIDER_TRANSFER_STATUS.COMPLETED,
    amountPaid: { amount: "50375.00", currency: "NGN" },
    fee: { amount: "375.00", currency: "NGN" },
    paidAt: new Date(),
    sender: null,
    ...overrides,
});
