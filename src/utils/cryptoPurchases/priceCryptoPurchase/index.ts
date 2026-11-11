import Decimal from "decimal.js";

interface IPriceCryptoPurchase {
    /** Our naira per coin, before markup. */
    rate: string;
    markupPercent: string;
    /** The provider's fee for one send, in the coin. */
    networkFee: string;
    /** Decimal places the provider accepts for this coin. */
    precision: number;
    /** Either: what the user wants to receive (coin) … */
    cryptoAmount?: string | null;
    /** … or how much naira they want to spend in total. */
    nairaTotal?: string | null;
}

const ceilKobo = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_UP);

/**
 * Prices a purchase. Always rounds in Doviz's favour by at most a kobo / the
 * smallest coin unit: the unit price and naira amounts round UP, the coin the
 * user receives rounds DOWN. The network fee is priced in, so the user gets
 * exactly `cryptoAmount`. null when the amount is too small to buy anything.
 */
const priceCryptoPurchase = ({ rate, markupPercent, networkFee, precision, cryptoAmount, nairaTotal }: IPriceCryptoPurchase) => {
    const unitPrice = ceilKobo(new Decimal(rate).times(new Decimal(100).plus(markupPercent)).dividedBy(100));
    const fee = new Decimal(networkFee);

    const wanted = cryptoAmount
        ? new Decimal(cryptoAmount)
        : new Decimal(nairaTotal ?? "0").dividedBy(unitPrice).minus(fee);
    const crypto = wanted.toDecimalPlaces(precision, Decimal.ROUND_DOWN);
    if (crypto.lessThanOrEqualTo(0)) return null;

    const nairaAmount = ceilKobo(crypto.times(unitPrice));
    const nairaFee = ceilKobo(fee.times(unitPrice));

    return {
        unitPrice: unitPrice.toFixed(2),
        cryptoAmount: crypto.toFixed(),
        networkFee: fee.toFixed(),
        nairaAmount: nairaAmount.toFixed(2),
        nairaFee: nairaFee.toFixed(2),
        total: nairaAmount.plus(nairaFee).toFixed(2),
    };
};

export default priceCryptoPurchase;
