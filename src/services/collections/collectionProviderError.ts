import { COLLECTION_PROVIDER_ERROR_CODE, CollectionProviderErrorCode } from "@/constants/nairaDeposits";

/**
 * A failed collection provider call, in neutral terms every provider maps
 * into. Creating a deposit falls back to the next provider only on
 * `unavailable` / `configuration` (this provider can't serve right now).
 */
class CollectionProviderError extends Error {
    readonly code: CollectionProviderErrorCode;
    readonly status: number | null;
    readonly retryable: boolean;
    readonly providerMessage: string | null;

    constructor({ code, status, providerMessage }: { code: CollectionProviderErrorCode; status: number | null; providerMessage: string | null }) {
        super(`Collection provider request failed (${code}${status ? ` ${status}` : ""}): ${providerMessage ?? "no message"}`);
        this.name = "CollectionProviderError";
        this.code = code;
        this.status = status;
        this.retryable = code === COLLECTION_PROVIDER_ERROR_CODE.UNAVAILABLE || code === COLLECTION_PROVIDER_ERROR_CODE.INVALID_RESPONSE;
        this.providerMessage = providerMessage;
    }
}

export default CollectionProviderError;
