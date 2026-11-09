import Decimal from "decimal.js";
import { ProviderQuote } from "../../types";
import { BreetIntegration, BreetRateQuote } from "./breetTypes";
import resolveBreetPlatformFee from "./resolveBreetPlatformFee";

const Precise = Decimal.clone({ precision: 40 });

/**
 * Breet's calculator prices $1 → NGNAmount naira and cryptoAmount crypto.
 * Naira for X crypto = X × NGNAmount / cryptoAmount, minus Breet's platform
 * fee for that trade size, rounded DOWN to the kobo (never over-promises).
 */
const calculateBreetQuote = ({
    quote,
    cryptoAmount,
    platformFee,
}: {
    quote: BreetRateQuote;
    cryptoAmount: string;
    platformFee: BreetIntegration["platformFeePercent"];
}): ProviderQuote => {
    const cryptoPerUsd = new Precise(quote.cryptoAmount);
    if (cryptoPerUsd.lte(0)) throw new Error("Breet quote returned a non-positive crypto amount");

    const usdAmount = new Precise(cryptoAmount).dividedBy(cryptoPerUsd);
    const feePercent = resolveBreetPlatformFee({ fee: platformFee, usdAmount });

    const gross = usdAmount.times(quote.NGNAmount);
    const afterFee = gross.times(new Precise(100).minus(feePercent)).dividedBy(100);

    return {
        grossNgn: afterFee.toDecimalPlaces(2, Decimal.ROUND_DOWN).toFixed(2),
        rateNgnPerUsd: new Precise(quote.rate).toFixed(),
    };
};

export default calculateBreetQuote;
