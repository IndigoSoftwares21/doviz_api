import {
    ProviderAsset,
    ProviderBank,
    ProviderDeposit,
    ProviderDepositAddress,
    ProviderQuote,
    ProviderWebhookEvent,
} from "./types";
import { ProviderEnvironment } from "@/constants/crypto";

export interface WebhookRequest {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    sourceIp: string | null;
}

/**
 * The only way the app talks to a crypto DEPOSIT provider (addresses,
 * deposits, conversion quotes, bank-name lookup). Naira payouts to users'
 * banks are a separate PayoutProvider (Breet can't pay arbitrary user banks). Implementations are
 * classes under services/crypto/providers/<name>/ (Breet first). Provider
 * quirks are translated inside the implementation and never leak out.
 */
export interface CryptoProvider {
    readonly name: string;
    /** sandbox or production — selects the catalog rows synced for it. */
    readonly environment: ProviderEnvironment;

    listAssets(): Promise<ProviderAsset[]>;
    listBanks(): Promise<ProviderBank[]>;
    resolveBankAccount(args: { providerBankId: string; accountNumber: string }): Promise<{ accountName: string }>;

    /** Idempotent per label: the same label never yields two addresses. */
    createDepositAddress(args: { providerAssetId: string; label: string }): Promise<ProviderDepositAddress>;
    /** Recovers an address created earlier whose response was lost. */
    findAddressByLabel(args: { providerCode: string; label: string }): Promise<ProviderDepositAddress | null>;

    getDeposit(args: { reference: string }): Promise<ProviderDeposit | null>;
    listRecentDeposits(args: { since: Date }): Promise<ProviderDeposit[]>;

    /** Estimated naira (after the provider's own fee) for a crypto amount. */
    getQuote(args: { providerAssetId: string; cryptoAmount: string }): Promise<ProviderQuote>;

    /**
     * The smallest deposit the provider accepts, IN COIN UNITS, right now.
     * Optional: for providers whose minimum isn't a fixed coin amount (e.g. a
     * USD value that moves with the price). Without it, the synced catalog's
     * minDeposit is used.
     */
    getMinDeposit?(args: { providerAssetId: string }): Promise<string | null>;

    /** True only for an authentic request from this provider. */
    verifyWebhook(request: WebhookRequest): boolean;
    parseWebhook(body: unknown): ProviderWebhookEvent | null;
    /** True for the provider's "is this URL alive?" ping — answered 200, never stored. */
    isWebhookPing(body: unknown): boolean;
}
