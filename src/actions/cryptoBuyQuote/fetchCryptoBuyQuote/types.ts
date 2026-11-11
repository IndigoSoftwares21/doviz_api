import priceCryptoPurchase from "@/utils/cryptoPurchases/priceCryptoPurchase";

export type CryptoBuyLimits = {
    symbol: string;
    /** The provider's smallest send, in the coin. */
    minCrypto: string;
    /** The least naira that buys it (or our floor, if higher). */
    minTotal: string;
    maxTotal: string;
    /** The amount asked for is over the maximum (else under the minimum). */
    tooHigh: boolean;
};

/** The conversion for an amount outside the limits: shown, not buyable. */
export type CryptoBuyPreview = {
    asset: { id: string; symbol: string; network: string; name: string };
    memoRequired: boolean;
    rateExpiresAt: Date;
    currency: string;
} & NonNullable<ReturnType<typeof priceCryptoPurchase>>;
