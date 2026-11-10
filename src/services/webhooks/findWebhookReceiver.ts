import providerRegistry from "@/services/crypto/providerRegistry";
import billProviderRegistry from "@/services/bills/billProviderRegistry";
import collectionProviderRegistry from "@/services/collections/collectionProviderRegistry";
import { WebhookRequest } from "@/services/crypto/cryptoProvider";
import { ProviderWebhookEvent } from "@/services/crypto/types";

/** Anything that can authenticate and read its own webhooks (crypto, bill and collection providers alike). */
export interface WebhookReceiver {
    readonly name: string;
    verifyWebhook(request: WebhookRequest): boolean;
    parseWebhook(body: unknown): ProviderWebhookEvent | null;
    isWebhookPing(body: unknown): boolean;
}

/**
 * The provider behind POST /webhooks/:provider, from whichever registry has
 * it. null = no such provider (404). A provider in both registries (e.g. one
 * doing crypto payouts and bills) answers through the crypto one, so it must
 * parse every webhook type it sends.
 */
const findWebhookReceiver = ({ name }: { name: string }): WebhookReceiver | null => {
    if (providerRegistry.has({ name })) return providerRegistry.get({ name });
    if (billProviderRegistry.has({ name })) return billProviderRegistry.get({ name });
    if (collectionProviderRegistry.has({ name })) return collectionProviderRegistry.get({ name });
    return null;
};

export default findWebhookReceiver;
