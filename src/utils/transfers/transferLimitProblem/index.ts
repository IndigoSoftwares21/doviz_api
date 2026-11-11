import Decimal from "decimal.js";
import FormatNaira from "@/utils/bills/formatNaira";

export interface TransferLimits {
    minAmount: string;
    maxPerTransfer: string;
    maxPerDay: string;
}

/** "₦640,000" (kobo only when there are any). */
const naira = (value: Decimal.Value) => `₦${FormatNaira({ value: new Decimal(value).toFixed(2) }).replace(/\.00$/, "")}`;

/**
 * Why this amount can't be sent now (null = it can): below the minimum,
 * above the per-transfer cap, or over what's left of the rolling 24-hour cap.
 * Shown to the user as the amount field's error.
 */
const transferLimitProblem = ({ amount, limits, sentToday }: { amount: string; limits: TransferLimits; sentToday: string }) => {
    const value = new Decimal(amount);
    if (value.lessThan(limits.minAmount)) return `The minimum transfer is ${naira(limits.minAmount)}`;
    if (value.greaterThan(limits.maxPerTransfer)) return `You can send up to ${naira(limits.maxPerTransfer)} per transfer`;

    const remaining = Decimal.max(new Decimal(limits.maxPerDay).minus(sentToday), 0);
    if (value.greaterThan(remaining)) {
        return remaining.isZero()
            ? `You've reached your ${naira(limits.maxPerDay)} daily sending limit. Try again later.`
            : `You can send up to ${naira(remaining)} more today`;
    }
    return null;
};

export default transferLimitProblem;
