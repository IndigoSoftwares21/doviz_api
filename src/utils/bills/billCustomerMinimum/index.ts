import Decimal from "decimal.js";

/**
 * The least a customer (a meter, a smartcard) can be paid: the provider's own
 * minimum for them, plus the provider's fee as a margin — a vend at exactly a
 * meter's minimum was refused by the biller (₦900 AEDC, 2026-11-12), so the
 * amount reaching the biller must clear its minimum even if the fee is taken
 * from it. null when the provider gives no minimum.
 */
const billCustomerMinimum = ({ minAmount, providerFee }: { minAmount: string | null; providerFee: string }) =>
    minAmount === null ? null : new Decimal(minAmount).plus(providerFee).toFixed(2);

export default billCustomerMinimum;
