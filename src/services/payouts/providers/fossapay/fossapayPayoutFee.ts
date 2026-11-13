import Decimal from "decimal.js";

/**
 * Fossapay's fee for a payout to a bank, by amount (their published schedule,
 * 2026-11-13; stamp duty included above ₦10,000). Bands include their upper
 * bound: ₦5,000 → ₦20, ₦10,000 → ₦40, ₦50,000 → ₦100. Edit here if Fossapay's
 * prices change — the fee actually charged is always read back from each payout.
 */
export const FOSSAPAY_PAYOUT_FEE_TIERS = [
    { upTo: "5000", fee: "20.00" },
    { upTo: "10000", fee: "40.00" },
    { upTo: "50000", fee: "100.00" },
    { upTo: null, fee: "150.00" },
] as const;

/** The fee Fossapay will charge for paying out `amount` (naira). */
const fossapayPayoutFee = ({ amount }: { amount: string }) =>
    FOSSAPAY_PAYOUT_FEE_TIERS.find((tier) => tier.upTo === null || new Decimal(amount).lte(tier.upTo))!.fee;

export default fossapayPayoutFee;
