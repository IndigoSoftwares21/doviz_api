import { BILL_PROVIDER_ERROR_CODE, BillProviderErrorCode } from "@/constants/bills";

/**
 * A failed bill provider call, in neutral terms every provider maps into.
 * The payment flow relies on `code`: only `rejected` and `configuration` mean
 * "definitely not charged" (safe to refund); `unavailable` / `invalid_response` mean the
 * outcome is unknown and must be looked up later — never refunded on a guess.
 */
class BillProviderError extends Error {
    readonly code: BillProviderErrorCode;
    readonly status: number | null;
    readonly retryable: boolean;
    readonly providerMessage: string | null;

    constructor({ code, status, providerMessage }: { code: BillProviderErrorCode; status: number | null; providerMessage: string | null }) {
        super(`Bill provider request failed (${code}${status ? ` ${status}` : ""}): ${providerMessage ?? "no message"}`);
        this.name = "BillProviderError";
        this.code = code;
        this.status = status;
        this.retryable = code === BILL_PROVIDER_ERROR_CODE.UNAVAILABLE || code === BILL_PROVIDER_ERROR_CODE.INVALID_RESPONSE;
        this.providerMessage = providerMessage;
    }
}

export default BillProviderError;
