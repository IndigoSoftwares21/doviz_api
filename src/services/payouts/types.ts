import { ProviderPayoutStatus } from "@/constants/withdrawals";

/** Provider-neutral payout shapes. Amounts are decimal strings with their currency. */

export interface PayoutMoney {
    amount: string;
    currency: string;
}

export interface ProviderPayoutBank {
    /** What this provider calls the bank (often the CBN code). */
    providerBankId: string;
    name: string;
    /** Neutral identity shared across providers (see toBankSlug). */
    slug: string;
    /** Real CBN/NIP code, or null when the provider doesn't give one. */
    code: string | null;
}

export interface ProviderPayout {
    /** OUR withdrawal id, sent to the provider as its reference. */
    externalId: string;
    providerReference: string | null;
    status: ProviderPayoutStatus;
    amount: PayoutMoney;
    /** The provider's real fee for this payout, once it says. */
    fee: PayoutMoney | null;
    failureReason: string | null;
}
