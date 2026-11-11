import Decimal from "decimal.js";
import fetchActiveCryptoSendProvider from "@/actions/cryptoSendProvider/fetchActiveCryptoSendProvider";
import fetchCryptoBuyRate from "@/actions/cryptoBuyRate/fetchCryptoBuyRate";
import priceCryptoPurchase from "@/utils/cryptoPurchases/priceCryptoPurchase";
import selectBuyAssets from "./queries/selectBuyAsset";
import fetchSendTerms from "./utils/fetchSendTerms";
import ACTION_FAILURE from "@/constants/actionFailure";
import CRYPTO_PURCHASES from "@/constants/cryptoPurchases";

interface IFetchCryptoBuyQuote {
    assetId: string;
    /** One of: the coin to receive … */
    cryptoAmount?: string | null;
    /** … or the naira to spend in total. */
    nairaTotal?: string | null;
}

/**
 * What buying this coin costs right now, with the provider active NOW and our
 * current rate. Shown before the PIN; recomputed on confirm (a different
 * total → the user re-confirms). Fails (nothing to buy) when: no provider is
 * set up, the coin isn't buyable on it, our rate is missing/expired, the
 * provider has paused sends, or the amount is outside the limits — `limits`
 * then says what's allowed.
 */
export type CryptoBuyLimits = { symbol: string; minCrypto: string; minTotal: string; maxTotal: string };

const fetchCryptoBuyQuote = async ({ assetId, cryptoAmount, nairaTotal }: IFetchCryptoBuyQuote) => {
    const fail = (failure: string, limits: CryptoBuyLimits | null = null) => ({ data: null, failure, limits });

    const { data: provider } = await fetchActiveCryptoSendProvider();
    if (!provider) return fail(ACTION_FAILURE.PROVIDER_UNAVAILABLE);

    const [asset] = await selectBuyAssets({ provider: provider.name, environment: provider.environment, assetId });
    if (!asset) return fail(ACTION_FAILURE.ASSET_UNAVAILABLE);

    const { data: rate } = await fetchCryptoBuyRate({ symbol: asset.symbol });
    if (!rate) return fail(ACTION_FAILURE.RATE_UNAVAILABLE);

    const terms = await fetchSendTerms({ provider, asset });
    if (!terms || !terms.isEnabled) return fail(ACTION_FAILURE.ASSET_UNAVAILABLE);

    const limits = { symbol: asset.symbol, minCrypto: new Decimal(terms.minAmount).toFixed(), minTotal: CRYPTO_PURCHASES.MIN_TOTAL, maxTotal: CRYPTO_PURCHASES.MAX_TOTAL };
    const price = priceCryptoPurchase({ rate: rate.rate, markupPercent: rate.markupPercent, networkFee: terms.fee, precision: terms.precision, cryptoAmount, nairaTotal });
    const outOfRange =
        !price ||
        new Decimal(price.cryptoAmount).lessThan(terms.minAmount) ||
        new Decimal(price.total).lessThan(CRYPTO_PURCHASES.MIN_TOTAL) ||
        new Decimal(price.total).greaterThan(CRYPTO_PURCHASES.MAX_TOTAL);
    if (outOfRange) return fail(ACTION_FAILURE.AMOUNT_OUT_OF_RANGE, limits);

    const data = {
        provider,
        asset: { id: asset.id, symbol: asset.symbol, network: asset.network, name: asset.name },
        providerAssetId: asset.providerAssetId,
        memoRequired: terms.memoRequired,
        precision: terms.precision,
        rateId: rate.id,
        rateExpiresAt: rate.expiresAt,
        currency: CRYPTO_PURCHASES.CURRENCY,
        ...price,
    };

    return { data, failure: null, limits: null };
};

export default fetchCryptoBuyQuote;
