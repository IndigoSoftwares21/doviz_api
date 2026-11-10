import Decimal from "decimal.js";
import { PROVIDER_BILL_STATUS } from "@/constants/bills";
import { ProviderBillPayment } from "../../types";
import FLUTTERWAVE from "./constants";
import { FlutterwaveBillStatus } from "./flutterwaveTypes";
import mapFlutterwaveBillStatus from "./mapFlutterwaveBillStatus";
import toFlutterwaveMoney from "./toFlutterwaveMoney";

const text = (value: string | null | undefined) => {
    const trimmed = (value ?? "").trim();
    return trimmed && trimmed.toLowerCase() !== "null" ? trimmed : null;
};

/**
 * A Flutterwave bill status record → our neutral payment. Cost to Doviz is
 * read from THIS payment's record — amount + fee − commission — never from a
 * fixed rate: Flutterwave's fees and commissions differ per biller, item and
 * amount, and change over time. Commission is credited back to the wallet
 * immediately (verified live: ₦100 airtime, commission 3 → wallet −₦97).
 */
const mapFlutterwaveBillPayment = ({
    externalId,
    record,
    requestedAmount,
}: {
    externalId: string;
    record: FlutterwaveBillStatus;
    /** Used when the record carries no amount. */
    requestedAmount: string;
}): ProviderBillPayment => {
    const currency = text(record.currency) ?? FLUTTERWAVE.COUNTRY_CURRENCY[FLUTTERWAVE.COUNTRY];
    const amount = toFlutterwaveMoney({ value: record.amount }) ?? requestedAmount;
    const fee = toFlutterwaveMoney({ value: record.fee });
    const commission = toFlutterwaveMoney({ value: record.commission });
    const status = mapFlutterwaveBillStatus({ status: record.status });
    const reportsCost = fee !== null || commission !== null;
    const cost = new Decimal(amount).plus(fee ?? 0).minus(commission ?? 0);

    return {
        externalId,
        providerReference: text(record.tx_ref) ?? text(record.flw_ref),
        status,
        amount: { amount, currency },
        cost: reportsCost ? { amount: cost.toFixed(2), currency } : null,
        token: text(record.extra) ?? text(record.token),
        failureReason: status === PROVIDER_BILL_STATUS.FAILED ? (text(record.message) ?? "Failed at provider") : null,
    };
};

export default mapFlutterwaveBillPayment;
