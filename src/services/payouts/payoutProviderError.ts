import { PAYOUT_PROVIDER_ERROR_CODE, PayoutProviderErrorCode } from "@/constants/withdrawals";

/**
 * A failed payout provider call, in neutral terms. Only `rejected` and
 * `configuration` mean "definitely not sent" (safe to refund); `unavailable`
 * / `invalid_response` mean the outcome is unknown and must be looked up —
 * never refunded on a guess.
 */
class PayoutProviderError extends Error {
    readonly code: PayoutProviderErrorCode;
    readonly status: number | null;
    readonly retryable: boolean;
    readonly providerMessage: string | null;

    constructor({ code, status, providerMessage }: { code: PayoutProviderErrorCode; status: number | null; providerMessage: string | null }) {
        super(`Payout provider request failed (${code}${status ? ` ${status}` : ""}): ${providerMessage ?? "no message"}`);
        this.name = "PayoutProviderError";
        this.code = code;
        this.status = status;
        this.retryable = code === PAYOUT_PROVIDER_ERROR_CODE.UNAVAILABLE || code === PAYOUT_PROVIDER_ERROR_CODE.INVALID_RESPONSE;
        this.providerMessage = providerMessage;
    }
}

export default PayoutProviderError;
