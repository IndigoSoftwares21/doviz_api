import { PayoutProvider } from "@/services/payouts/payoutProvider";
import payoutProviderRegistry from "@/services/payouts/payoutProviderRegistry";
import selectActivePayoutProviderName from "@/actions/payoutProvider/fetchActivePayoutProvider/queries/selectActivePayoutProviderName";
import { PROVIDER_ENVIRONMENT } from "@/constants/crypto";

export const FAKE_PAYOUT_PROVIDER = "fakepayout";

/** A PayoutProvider whose every method is a jest mock. */
export const createFakePayoutProvider = (overrides: Partial<PayoutProvider> = {}) => {
    const base = {
        name: FAKE_PAYOUT_PROVIDER,
        environment: PROVIDER_ENVIRONMENT.SANDBOX,
        listBanks: jest.fn().mockResolvedValue([]),
        resolveAccount: jest.fn(),
        sendPayout: jest.fn(),
        getPayout: jest.fn().mockResolvedValue(null),
    };
    return { ...base, ...overrides } as typeof base & Partial<PayoutProvider>;
};

/**
 * Registers a fresh fake and makes it the ACTIVE payout provider. Tests using
 * this must `jest.mock` the selectActivePayoutProviderName query module.
 */
export const useFakePayoutProvider = (overrides: Partial<PayoutProvider> = {}) => {
    payoutProviderRegistry.reset();
    const provider = createFakePayoutProvider(overrides);
    payoutProviderRegistry.register(provider as PayoutProvider);
    jest.mocked(selectActivePayoutProviderName).mockResolvedValue({ activeProvider: provider.name });
    return provider;
};
