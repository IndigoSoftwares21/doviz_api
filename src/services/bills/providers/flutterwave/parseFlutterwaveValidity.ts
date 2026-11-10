/**
 * Flutterwave's `validity_period` in days. It comes as "30s", "7s", "2s"
 * (days, with an "s"), plain "30" / 30, or null. Anything else → null.
 */
const parseFlutterwaveValidity = ({ value }: { value: string | number | null | undefined }) => {
    const match = /^(\d+)\s*s?$/i.exec(String(value ?? "").trim());
    const days = match ? Number(match[1]) : NaN;
    return Number.isInteger(days) && days > 0 ? days : null;
};

export default parseFlutterwaveValidity;
