import Decimal from "decimal.js";

/**
 * The fee the user pays on top of a bill's amount: whatever the provider
 * charges us for it (passed through, so a bill never costs us money) plus
 * our own service fee. Shown to the user as one "service fee".
 */
const billFee = ({ providerFee, serviceFee }: { providerFee: string; serviceFee: string }) =>
    new Decimal(providerFee).plus(serviceFee).toFixed(2);

export default billFee;
