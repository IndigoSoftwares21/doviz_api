import Decimal from "decimal.js";
import { PROVIDER_PAYOUT_STATUS, ProviderPayoutStatus } from "@/constants/withdrawals";
import { ProviderPayout } from "../../types";
import { KorapayPayoutRecord } from "./korapayPayoutTypes";

const money = (value: number | string | null | undefined) => {
    if (value === null || value === undefined || value === "") return null;
    try {
        return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_UP).toFixed(2);
    } catch {
        return null;
    }
};

/** Korapay's payout status words → ours. Unknown words stay pending: never refund on a guess. */
export const mapKorapayPayoutStatus = ({ status }: { status: string | null | undefined }): ProviderPayoutStatus => {
    const value = (status ?? "").trim().toLowerCase();
    if (["success", "successful", "completed"].includes(value)) return PROVIDER_PAYOUT_STATUS.COMPLETED;
    if (["failed", "failure", "reversed", "cancelled"].includes(value)) return PROVIDER_PAYOUT_STATUS.FAILED;
    return PROVIDER_PAYOUT_STATUS.PENDING;
};

/** A Korapay payout record → our neutral payout. The fee is Korapay's real fee for it (rounded up to the kobo). */
const mapKorapayPayout = ({ externalId, record, currency }: { externalId: string; record: KorapayPayoutRecord; currency: string }): ProviderPayout => {
    const status = mapKorapayPayoutStatus({ status: record.status });
    const fee = money(record.fee);
    const recordCurrency = record.currency || currency;
    return {
        externalId,
        providerReference: record.trace_id || record.reference || null,
        status,
        amount: { amount: money(record.amount) ?? "0.00", currency: recordCurrency },
        fee: fee === null ? null : { amount: fee, currency: recordCurrency },
        failureReason: status === PROVIDER_PAYOUT_STATUS.FAILED ? record.message || "Payout failed" : null,
    };
};

export default mapKorapayPayout;
