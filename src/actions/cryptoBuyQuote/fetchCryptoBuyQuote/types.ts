import priceCryptoPurchase from "@/utils/cryptoPurchases/priceCryptoPurchase";

export type CryptoBuyLimits = {
    symbol: string;
    /** The provider's smallest send, in the coin. */
    minCrypto: string;
    /** The least naira that buys it (or our floor, if higher). */
    minTotal: string;
    /** The most coin our stock can deliver in one purchase (null = no stock cap). */
    maxCrypto: string | null;
    /** The most naira one purchase can spend: our cap, or less when stock is the limit. */
    maxTotal: string;
    /** maxTotal comes from our stock, not our per-purchase cap. */
    stockLimited: boolean;
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
