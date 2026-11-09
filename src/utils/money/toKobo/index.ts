import Decimal from "decimal.js";

/**
 * Naira to 2 decimals, rounded DOWN: when a provider reports more precision
 * than a kobo, we never record more than it actually credited.
 */
const toKobo = ({ value }: { value: string }) => {
    const naira = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_DOWN);

    return naira.toFixed(2);
};

export default toKobo;
