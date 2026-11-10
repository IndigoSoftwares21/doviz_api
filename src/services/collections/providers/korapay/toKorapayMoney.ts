import Decimal from "decimal.js";

/** Korapay sends amounts as numbers or strings; ours are 2-decimal strings. null when absent or unreadable. */
const toKorapayMoney = ({ value }: { value: number | string | null | undefined }) => {
    if (value === null || value === undefined || value === "") return null;
    try {
        const amount = new Decimal(value);
        return amount.isFinite() ? amount.toDecimalPlaces(2, Decimal.ROUND_DOWN).toFixed(2) : null;
    } catch {
        return null;
    }
};

export default toKorapayMoney;
