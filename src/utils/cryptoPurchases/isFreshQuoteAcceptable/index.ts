import Decimal from "decimal.js";
import CRYPTO_PURCHASES from "@/constants/cryptoPurchases";

interface IIsFreshQuoteAcceptable {
    /** What the user confirmed. */
    expectedTotal: string;
    /** The coin they saw. Absent (older apps): the total must match exactly. */
    expectedCryptoAmount: string | null;
    /** The price now, on confirm. */
    fresh: { total: string; cryptoAmount: string };
}

/**
 * Whether to buy at the fresh price without asking again. Prices (ETH…) move
 * between the quote and the PIN, so we never charge MORE than the confirmed
 * total, and never give LESS coin than they saw beyond
 * RECEIVE_TOLERANCE_PERCENT. Anything at least as good goes ahead (paying the
 * fresh, lower-or-equal total). Otherwise → 409, they re-confirm.
 */
const isFreshQuoteAcceptable = ({ expectedTotal, expectedCryptoAmount, fresh }: IIsFreshQuoteAcceptable) => {
    if (new Decimal(fresh.total).greaterThan(expectedTotal)) return false;
    if (expectedCryptoAmount === null) return new Decimal(fresh.total).equals(expectedTotal);

    const floor = new Decimal(expectedCryptoAmount).times(new Decimal(100).minus(CRYPTO_PURCHASES.RECEIVE_TOLERANCE_PERCENT)).dividedBy(100);
    return new Decimal(fresh.cryptoAmount).greaterThanOrEqualTo(floor);
};

export default isFreshQuoteAcceptable;
