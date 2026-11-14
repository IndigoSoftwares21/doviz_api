import Decimal from "decimal.js";
import { CryptoStock } from "../fetchCryptoStock";

/**
 * The most coin one purchase can deliver on a network from this stock: the
 * balance less the network fee (KuCoin takes the fee from our balance on top),
 * rounded down to what the provider accepts. null = no cap (the provider can't
 * report stock). "0" = nothing can be sent.
 */
const maxSendable = ({ stock, fee, precision }: { stock: CryptoStock; fee: string; precision: number }) => {
    if (stock.status === "unlimited") return null;
    if (stock.status === "unknown") return "0";
    const max = new Decimal(stock.balance).minus(fee).toDecimalPlaces(precision, Decimal.ROUND_DOWN);
    return Decimal.max(max, 0).toFixed();
};

export default maxSendable;
