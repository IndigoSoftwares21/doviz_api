import { WebhookRequest } from "@/services/crypto/cryptoProvider";
import { ProviderWebhookEvent } from "@/services/crypto/types";
import { ProviderTransferSender } from "@/services/collections/types";

/**
 * Issues each verified user a personal account number, and tells us about
 * money paid into it. Provider-agnostic:
 * Squad is the first implementation. Never logs a request or reply (they
 * hold KYC data). Failures throw VirtualAccountProviderError.
 */
export interface VirtualAccountCustomer {
    /** OUR opaque reference for the user at the provider — the same every time for the same user. */
    customerRef: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    /** YYYY-MM-DD */
    dateOfBirth: string;
    gender: string;
    address: string;
    /** Collected at KYC; null for users verified before it was asked. */
    city: string | null;
    bvn: string;
    /** E.164, verified by SMS code. */
    phoneNumber: string;
    email: string;
}

export interface ProviderVirtualAccount {
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string | null;
}

/** A payment into one of our account numbers, as the provider's OWN record says (never a webhook body). */
export interface ProviderAccountDeposit {
    reference: string;
    /** The account number it was paid into. */
    accountNumber: string;
    status: "completed" | "pending" | "failed";
    /** Gross: what the sender sent. */
    amount: { amount: string; currency: string };
    /** What the provider kept; null when it doesn't say. */
    fee: { amount: string; currency: string } | null;
    paidAt: Date | null;
    sender: ProviderTransferSender | null;
}

export interface VirtualAccountProvider {
    readonly name: string;
    readonly environment: "sandbox" | "production";
    /** Creates the account. Safe to retry: an account that already exists for `customerRef` is returned, not duplicated. */
    createAccount(customer: VirtualAccountCustomer): Promise<ProviderVirtualAccount>;

    /** Receiving — every provider that issued an account must keep these working, even after another becomes active. */
    verifyWebhook(request: WebhookRequest): boolean;
    /** A deposit → resourceType `account_deposit`, resourceId = its reference. Anything else → `other` (acknowledged, ignored). */
    parseWebhook(body: unknown): ProviderWebhookEvent | null;
    isWebhookPing(body: unknown): boolean;
    /** Re-fetches a deposit from the provider. null = no such deposit. Throws when the provider can't be reached. */
    getDeposit(args: { reference: string }): Promise<ProviderAccountDeposit | null>;

    /**
     * Only for providers that leave deposits in a per-user wallet (Fossapay):
     * moves `amount` from that wallet into our pooled (master) wallet. The same
     * `reference` must never move money twice. Throws if it didn't happen.
     */
    sweepToPool?(args: { fromAccount: string; amount: string; reference: string }): Promise<void>;
}

export const VIRTUAL_ACCOUNT_ERROR = {
    /** The provider refused the customer (e.g. details don't match the BVN) — not retryable as is. */
    REJECTED: "rejected",
    /** Outage, timeout, or our setup — try again later. */
    UNAVAILABLE: "unavailable",
} as const;

export class VirtualAccountProviderError extends Error {
    constructor(
        readonly code: (typeof VIRTUAL_ACCOUNT_ERROR)[keyof typeof VIRTUAL_ACCOUNT_ERROR],
        readonly providerMessage: string | null,
    ) {
        super(providerMessage ?? code);
    }
}
