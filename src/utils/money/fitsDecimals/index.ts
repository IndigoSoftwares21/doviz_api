import Decimal from "decimal.js";

/** True when `value` has no more decimal places than `decimals` (no hidden rounding). */
const fitsDecimals = ({ value, decimals }: { value: string; decimals: number }) => {
    const amount = new Decimal(value);

    return amount.decimalPlaces() <= decimals;
};

export default fitsDecimals;
