import { CRYPTO_SEND_ERROR_CODE, CryptoSendErrorCode } from "@/constants/cryptoPurchases";

/**
 * A failed crypto-send provider call, in neutral terms. Only `rejected` and
 * `configuration` mean "definitely not sent" (safe to refund); `unavailable`
 * / `invalid_response` mean the outcome is unknown and must be looked up —
 * never refunded on a guess (sent crypto can't be pulled back).
 */
class CryptoSendProviderError extends Error {
    readonly code: CryptoSendErrorCode;
    readonly status: number | null;
    readonly retryable: boolean;
    readonly providerMessage: string | null;

    constructor({ code, status, providerMessage }: { code: CryptoSendErrorCode; status: number | null; providerMessage: string | null }) {
        super(`Crypto send provider request failed (${code}${status ? ` ${status}` : ""}): ${providerMessage ?? "no message"}`);
        this.name = "CryptoSendProviderError";
        this.code = code;
        this.status = status;
        this.retryable = code === CRYPTO_SEND_ERROR_CODE.UNAVAILABLE || code === CRYPTO_SEND_ERROR_CODE.INVALID_RESPONSE;
        this.providerMessage = providerMessage;
    }
}

export default CryptoSendProviderError;
