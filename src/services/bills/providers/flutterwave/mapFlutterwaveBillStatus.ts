import { PROVIDER_BILL_STATUS, ProviderBillStatus } from "@/constants/bills";

/**
 * Flutterwave's bill status strings → ours. Its docs use both "success" and
 * "successful". Anything unrecognised stays `pending`: a payment is only
 * ever refunded on an explicit failure, never on a word we don't know.
 */
const mapFlutterwaveBillStatus = ({ status }: { status: string | null | undefined }): ProviderBillStatus => {
    const value = (status ?? "").trim().toLowerCase();
    if (["success", "successful", "completed"].includes(value)) return PROVIDER_BILL_STATUS.COMPLETED;
    if (["failed", "fail", "failure", "reversed", "cancelled"].includes(value)) return PROVIDER_BILL_STATUS.FAILED;
    return PROVIDER_BILL_STATUS.PENDING;
};

export default mapFlutterwaveBillStatus;
