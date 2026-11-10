import Decimal from "decimal.js";
import toKorapayMoney from "./toKorapayMoney";

type KorapayAmount = number | string | null | undefined;

/** Korapay reports its fee and the VAT on it separately; the cost is both. null when neither is given. */
const sumKorapayFee = ({ fee, vat }: { fee: KorapayAmount; vat: KorapayAmount }) => {
    const parts = [toKorapayMoney({ value: fee }), toKorapayMoney({ value: vat })].filter((value): value is string => value !== null);
    if (parts.length === 0) return null;
    return parts.reduce((sum, value) => sum.plus(value), new Decimal(0)).toFixed(2);
};

export default sumKorapayFee;
