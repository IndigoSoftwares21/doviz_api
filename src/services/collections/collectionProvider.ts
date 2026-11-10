import { ProviderEnvironment } from "@/constants/crypto";
import { WebhookRequest } from "@/services/crypto/cryptoProvider";
import { ProviderWebhookEvent } from "@/services/crypto/types";
import { CreateBankTransferArgs, ProviderBankTransfer, ProviderBankTransferCreated } from "./types";

/**
 * The only way the app talks to a naira COLLECTION provider (one-time bank
 * transfer accounts). Implementations are classes under
 * services/collections/providers/<name>/ (Korapay first). Provider quirks —
 * status strings, fee fields, how the fee is put on the payer — are
 * translated inside the implementation. Switching provider never needs an
 * app change.
 */
export interface CollectionProvider {
    readonly name: string;
    readonly environment: ProviderEnvironment;

    /**
     * Issues a one-time account. `externalId` is our naira_deposits.id, sent
     * as the provider's reference. When `feeBearer` is `user` the provider's
     * fee is added to what the payer sends; when `doviz` it's taken from our
     * settlement. Failures throw CollectionProviderError.
     */
    createBankTransfer(args: CreateBankTransferArgs): Promise<ProviderBankTransferCreated>;

    /** By OUR external id, plus the provider's reference when we have it. null = no record. */
    getBankTransfer(args: { externalId: string; providerReference: string | null }): Promise<ProviderBankTransfer | null>;

    /** True only for an authentic request from this provider. */
    verifyWebhook(request: WebhookRequest): boolean;
    /**
     * Webhook body → neutral event. A deposit event has resourceType
     * `naira_deposit` and resourceId = our external id or the provider's
     * reference; the body is never trusted for money (the transfer is re-fetched).
     */
    parseWebhook(body: unknown): ProviderWebhookEvent | null;
    /** True for a "is this URL alive?" ping — answered 200, never stored. */
    isWebhookPing(body: unknown): boolean;
}
