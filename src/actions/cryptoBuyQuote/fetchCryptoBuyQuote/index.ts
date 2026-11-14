import Decimal from "decimal.js";
import fetchActiveCryptoSendProvider from "@/actions/cryptoSendProvider/fetchActiveCryptoSendProvider";
import fetchCryptoBuyPrice from "@/actions/cryptoBuyPrice/fetchCryptoBuyPrice";
import priceCryptoPurchase from "@/utils/cryptoPurchases/priceCryptoPurchase";
import selectBuyAssets from "./queries/selectBuyAsset";
import fetchSendTerms from "./utils/fetchSendTerms";
import fetchCryptoStock from "@/utils/cryptoPurchases/fetchCryptoStock";
import maxSendable from "@/utils/cryptoPurchases/maxSendable";
import ACTION_FAILURE from "@/constants/actionFailure";
import CRYPTO_PURCHASES from "@/constants/cryptoPurchases";
import { CryptoBuyLimits, CryptoBuyPreview } from "./types";

interface IFetchCryptoBuyQuote {
    assetId: string;
    /** One of: the coin to receive … */
    cryptoAmount?: string | null;
    /** … or the naira to spend in total. */
    nairaTotal?: string | null;
}

export type { CryptoBuyLimits } from "./types";

/**
 * What buying this coin costs right now, with the provider active NOW and our
 * current price (fetchCryptoBuyPrice: a rate we set, or the market). Shown
 * before the PIN; recomputed on confirm. Fails (nothing to buy) when: no
 * provider is set up, the coin isn't buyable on it, there's no price we trust, the
 * provider has paused sends, we don't hold enough of the coin to send even
 * the minimum, or the amount is outside the limits (ours, the provider's
 * minimum, or what our stock can deliver) — `limits`
 * then says what's allowed, and `preview` still has the conversion (so the
 * app can show "≈ 0.5 USDT" next to "the minimum is …"; it can't be bought).
 */
const fetchCryptoBuyQuote = async ({ assetId, cryptoAmount, nairaTotal }: IFetchCryptoBuyQuote) => {
    const fail = (failure: string, limits: CryptoBuyLimits | null = null, preview: CryptoBuyPreview | null = null) => ({ data: null, failure, limits, preview });

    const { data: provider } = await fetchActiveCryptoSendProvider();
    if (!provider) return fail(ACTION_FAILURE.PROVIDER_UNAVAILABLE);

    const [asset] = await selectBuyAssets({ provider: provider.name, environment: provider.environment, assetId });
    if (!asset) return fail(ACTION_FAILURE.ASSET_UNAVAILABLE);

    const { data: rate } = await fetchCryptoBuyPrice({ provider, symbol: asset.symbol });
    if (!rate) return fail(ACTION_FAILURE.RATE_UNAVAILABLE);

    const terms = await fetchSendTerms({ provider, asset });
    if (!terms || !terms.isEnabled) return fail(ACTION_FAILURE.ASSET_UNAVAILABLE);

    const stock = await fetchCryptoStock({ provider, symbol: asset.symbol, providerAssetId: asset.providerAssetId });
    const maxCrypto = maxSendable({ stock, fee: terms.fee, precision: terms.precision });
    if (maxCrypto !== null && new Decimal(maxCrypto).lessThan(terms.minAmount)) return fail(ACTION_FAILURE.STOCK_UNAVAILABLE);

    const pricing = {
        rate: rate.rate,
        markupPercent: rate.markupPercent,
        networkFee: terms.fee,
        precision: terms.precision,
    };
    const price = priceCryptoPurchase({ ...pricing, cryptoAmount, nairaTotal });
    const cheapest = priceCryptoPurchase({
        ...pricing,
        cryptoAmount: terms.minAmount,
    });
    const most = maxCrypto === null ? null : priceCryptoPurchase({ ...pricing, cryptoAmount: maxCrypto });
    const stockLimited = most !== null && new Decimal(most.total).lessThan(CRYPTO_PURCHASES.MAX_TOTAL);
    const maxTotal = stockLimited ? most.total : CRYPTO_PURCHASES.MAX_TOTAL;
    const overStock = price !== null && maxCrypto !== null && new Decimal(price.cryptoAmount).greaterThan(maxCrypto);
    const limits: CryptoBuyLimits = {
        symbol: asset.symbol,
        minCrypto: new Decimal(terms.minAmount).toFixed(),
        minTotal: Decimal.max(CRYPTO_PURCHASES.MIN_TOTAL, cheapest?.total ?? 0).toFixed(2),
        maxCrypto,
        maxTotal,
        stockLimited,
        tooHigh: price !== null && (overStock || new Decimal(price.total).greaterThan(CRYPTO_PURCHASES.MAX_TOTAL)),
    };
    if (!price) return fail(ACTION_FAILURE.AMOUNT_OUT_OF_RANGE, limits);

    const data = {
        provider,
        asset: { id: asset.id, symbol: asset.symbol, network: asset.network, name: asset.name },
        providerAssetId: asset.providerAssetId,
        memoRequired: terms.memoRequired,
        precision: terms.precision,
        rateId: rate.rateId,
        rateExpiresAt: rate.expiresAt,
        priceSource: rate.source,
        marketPriceUsdt: rate.marketPriceUsdt,
        markupPercent: rate.markupPercent,
        currency: CRYPTO_PURCHASES.CURRENCY,
        ...price,
    };

    const outOfRange =
        new Decimal(price.cryptoAmount).lessThan(terms.minAmount) ||
        new Decimal(price.total).lessThan(CRYPTO_PURCHASES.MIN_TOTAL) ||
        new Decimal(price.total).greaterThan(CRYPTO_PURCHASES.MAX_TOTAL) ||
        overStock;
    if (outOfRange) return fail(ACTION_FAILURE.AMOUNT_OUT_OF_RANGE, limits, data);

    return { data, failure: null, limits: null, preview: null };
};

export default fetchCryptoBuyQuote;
