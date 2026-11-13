import Decimal from "decimal.js";
import { PROVIDER_PAYOUT_STATUS } from "@/constants/withdrawals";
import { ProviderPayout } from "../../types";

/** Fossapay payout statuses: processing (not final), completed, failed, reversed (money returned). */
const STATUS: Record<string, ProviderPayout["status"]> = {
    completed: PROVIDER_PAYOUT_STATUS.COMPLETED,
    success: PROVIDER_PAYOUT_STATUS.COMPLETED,
    failed: PROVIDER_PAYOUT_STATUS.FAILED,
    reversed: PROVIDER_PAYOUT_STATUS.FAILED,
};

/** A Fossapay payout record → our neutral payout. The fee is Fossapay's own, for THIS payout. */
const mapFossapayPayout = ({ externalId, record, currency }: { externalId: string; record: Record<string, unknown>; currency: string }): ProviderPayout => {
    const state = String(record.status ?? "").toLowerCase();
    const status = STATUS[state] ?? PROVIDER_PAYOUT_STATUS.PENDING;
    const fee = record.fee === undefined || record.fee === null ? null : { amount: new Decimal(String(record.fee)).toFixed(2), currency };
    return {
        externalId,
        providerReference: typeof record.payoutId === "string" ? record.payoutId : typeof record.id === "string" ? record.id : null,
        status,
        amount: { amount: new Decimal(String(record.amount ?? 0)).toFixed(2), currency },
        fee,
        failureReason: status === PROVIDER_PAYOUT_STATUS.FAILED ? (state === "reversed" ? "The bank returned the transfer" : String(record.failureReason ?? record.message ?? "Failed at provider")) : null,
    };
};

export default mapFossapayPayout;
