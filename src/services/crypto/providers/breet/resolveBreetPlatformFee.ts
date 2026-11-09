import Decimal from "decimal.js";
import { BreetIntegration } from "./breetTypes";

const parse = (value: unknown) => {
    if (typeof value !== "number" && typeof value !== "string") return null;
    try {
        return new Decimal(value);
    } catch {
        return null;
    }
};

const toPercent = (value: unknown) => {
    const percent = parse(value);
    if (!percent || !percent.isFinite() || percent.lt(0) || percent.gte(100)) {
        throw new Error("Breet platform fee is missing or not a valid percent");
    }
    return percent;
};

/**
 * Breet's own fee percent for a trade of `usdAmount`. Breet returns either a
 * flat percent or tiers [{ min, max, rate }] by trade size in USD; the tier
 * is the highest `min` the trade reaches (so gaps like 999→1000 are covered).
 * Anything missing or malformed throws: a quote with a guessed fee could
 * over-promise naira, so no quote is safer than a wrong one.
 */
const resolveBreetPlatformFee = ({ fee, usdAmount }: { fee: BreetIntegration["platformFeePercent"]; usdAmount: Decimal }) => {
    if (!Array.isArray(fee)) return toPercent(fee);

    const tier = fee
        .filter((band) => typeof band?.min === "number" && usdAmount.gte(band.min))
        .sort((a, b) => b.min - a.min)[0];

    return toPercent(tier?.rate);
};

export default resolveBreetPlatformFee;
