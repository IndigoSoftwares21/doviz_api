import Decimal from "decimal.js";

/** Breet sends some amounts as JSON numbers; hand them on as exact strings. */
const toDecimalString = ({ value }: { value: number | string | null | undefined }) => {
    if (value === null || value === undefined || value === "") return null;
    const decimal = new Decimal(value);
    if (!decimal.isFinite()) return null;
    return decimal.toFixed();
};

export default toDecimalString;
