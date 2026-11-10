import Decimal from "decimal.js";
import FormatNaira from "@/utils/bills/formatNaira";

/** "You can send between ₦1,000.00 and ₦10,000,000.00 at a time" — for a provider's own limits. */
const describeLimits = ({ amount, limits }: { amount: string; limits: { minAmount: string; maxAmount: string } }) =>
    new Decimal(amount).lessThan(limits.minAmount)
        ? `Minimum is ₦${FormatNaira({ value: limits.minAmount })}`
        : `Maximum is ₦${FormatNaira({ value: limits.maxAmount })}`;

export default describeLimits;
