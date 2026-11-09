import { ProviderErrorCode } from "@/constants/cryptoStatus";

export type { ProviderErrorCode };

/**
 * A failed provider call. `retryable` tells callers whether trying again
 * later can help (rate limits, 5xx, network) or not (bad input, auth).
 */
class ProviderError extends Error {
    readonly code: ProviderErrorCode;
    readonly status: number | null;
    readonly retryable: boolean;
    readonly providerMessage: string | null;

    constructor({
        code,
        status,
        retryable,
        providerMessage,
    }: {
        code: ProviderErrorCode;
        status: number | null;
        retryable: boolean;
        providerMessage: string | null;
    }) {
        super(`Provider request failed (${code}${status ? ` ${status}` : ""}): ${providerMessage ?? "no message"}`);
        this.name = "ProviderError";
        this.code = code;
        this.status = status;
        this.retryable = retryable;
        this.providerMessage = providerMessage;
    }
}

export default ProviderError;
