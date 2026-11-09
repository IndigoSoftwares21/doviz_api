import { CryptoProvider } from "@/services/crypto/cryptoProvider";
import providerRegistry from "@/services/crypto/providerRegistry";
import { PROVIDER_ENVIRONMENT } from "@/constants/crypto";

export const FAKE_PROVIDER = "fakeprov";

/** A CryptoProvider whose every method is a jest mock. */
export const createFakeProvider = () => {
    const provider = {
        name: FAKE_PROVIDER,
        environment: PROVIDER_ENVIRONMENT.SANDBOX,
        listAssets: jest.fn(),
        listBanks: jest.fn(),
        resolveBankAccount: jest.fn(),
        createDepositAddress: jest.fn(),
        findAddressByLabel: jest.fn(),
        getDeposit: jest.fn(),
        listRecentDeposits: jest.fn(),
        getQuote: jest.fn(),
        verifyWebhook: jest.fn(),
        parseWebhook: jest.fn(),
    } satisfies CryptoProvider;
    return provider;
};

/** Registers a fresh fake as the ACTIVE provider and returns it. */
export const useFakeProvider = () => {
    process.env.CRYPTO_PROVIDER = FAKE_PROVIDER;
    const provider = createFakeProvider();
    providerRegistry.register(provider);
    return provider;
};
