import { DepositStatus } from "@/constants/crypto";
import { WebhookResourceType } from "@/constants/cryptoStatus";

/**
 * Provider-neutral shapes. Every provider maps its own API into these, so
 * nothing outside services/crypto/providers knows which provider is in use.
 * All amounts are decimal STRINGS — never JS numbers.
 */

export interface ProviderAsset {
    providerAssetId: string;
    providerCode: string;
    symbol: string;
    network: string;
    name: string;
    minDeposit: string | null;
    confirmations: number | null;
}

export interface ProviderBank {
    providerBankId: string;
    name: string;
    /** Neutral identity shared across providers (see toBankSlug). */
    slug: string;
    /** Real CBN/NIP code, or null when the provider doesn't give one. */
    code: string | null;
}

export interface ProviderDepositAddress {
    providerWalletId: string;
    address: string;
}

export interface ProviderDeposit {
    reference: string;
    address: string;
    providerCode: string;
    /** The provider's asset id, when its records use ids rather than codes. */
    providerAssetId?: string;
    status: DepositStatus;
    subStatus: string | null;
    cryptoAmount: string;
    /** Naira credited to Doviz for this deposit (after the provider's own fee). */
    grossNgn: string | null;
    reportedUsd: string | null;
    rateNgnPerUsd: string | null;
    txHash: string | null;
    senderAddress: string | null;
    confirmations: number | null;
    amlPassed: boolean | null;
    occurredAt: Date;
}

export interface ProviderQuote {
    /** Naira the provider would credit Doviz (after its own fee). Estimate only. */
    grossNgn: string;
    rateNgnPerUsd: string;
}

/** What a provider's webhook is about, once verified and parsed. */
export interface ProviderWebhookEvent {
    eventId: string;
    eventName: string;
    resourceType: WebhookResourceType;
    resourceId: string | null;
    eventTime: Date | null;
}
