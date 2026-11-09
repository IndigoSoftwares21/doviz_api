import { CryptoProvider } from "@/services/crypto/cryptoProvider";
import { ProviderDeposit } from "@/services/crypto/types";
import { PROVIDER_ENVIRONMENT } from "@/constants/crypto";

/** A provider double: proves the core never depends on a specific provider. */
export const makeFakeProvider = (overrides: Partial<CryptoProvider> = {}): CryptoProvider => ({
    name: "fakepay",
    environment: PROVIDER_ENVIRONMENT.SANDBOX,
    listAssets: jest.fn(),
    listBanks: jest.fn(),
    resolveBankAccount: jest.fn(),
    createDepositAddress: jest.fn(),
    findAddressByLabel: jest.fn(),
    getDeposit: jest.fn(),
    listRecentDeposits: jest.fn().mockResolvedValue([]),
    getQuote: jest.fn(),
    verifyWebhook: jest.fn().mockReturnValue(true),
    parseWebhook: jest.fn(),
    isWebhookPing: jest.fn(),
    ...overrides,
});

export const depositRecord = (overrides: Partial<ProviderDeposit> = {}): ProviderDeposit => ({
    reference: "trade-1",
    address: "TV8dNYY",
    providerCode: "USDT_TRX",
    status: "completed",
    subStatus: "completed",
    cryptoAmount: "100.5",
    grossNgn: "160000",
    reportedUsd: "100.00",
    rateNgnPerUsd: "1600",
    txHash: "0xabc",
    senderAddress: "Tsender",
    confirmations: 19,
    amlPassed: true,
    occurredAt: new Date("2026-11-09T12:00:00Z"),
    ...overrides,
});
