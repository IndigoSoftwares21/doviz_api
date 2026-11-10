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
 * amount + fee (what the wallet is debited); commission is paid back
 * separately and isn't netted here.
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
    const status = mapFlutterwaveBillStatus({ status: record.status });

    return {
        externalId,
        providerReference: text(record.tx_ref) ?? text(record.flw_ref),
        status,
        amount: { amount, currency },
        cost: fee === null ? null : { amount: new Decimal(amount).plus(fee).toFixed(2), currency },
        token: text(record.extra) ?? text(record.token),
        failureReason: status === PROVIDER_BILL_STATUS.FAILED ? (text(record.message) ?? "Failed at provider") : null,
    };
};

export default mapFlutterwaveBillPayment;
