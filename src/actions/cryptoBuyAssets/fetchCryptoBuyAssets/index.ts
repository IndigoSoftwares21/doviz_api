import Decimal from "decimal.js";
import fetchActiveCryptoSendProvider from "@/actions/cryptoSendProvider/fetchActiveCryptoSendProvider";
import fetchCryptoBuyRate from "@/actions/cryptoBuyRate/fetchCryptoBuyRate";
import selectBuyAssets from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote/queries/selectBuyAsset";
import priceCryptoPurchase from "@/utils/cryptoPurchases/priceCryptoPurchase";
import CRYPTO_PURCHASES from "@/constants/cryptoPurchases";

/**
 * Coins the user can buy right now, each with its network fee, minimum and
 * our current unit price. A coin without a rate in force is listed as
 * unavailable (so the app can say so) rather than hidden. Catalog terms only —
 * the quote checks them live.
 */
const fetchCryptoBuyAssets = async () => {
    const { data: provider } = await fetchActiveCryptoSendProvider();
    if (!provider) return { data: [] };

    const assets = await selectBuyAssets({ provider: provider.name, environment: provider.environment });
    const rates = new Map<string, Awaited<ReturnType<typeof fetchCryptoBuyRate>>["data"]>();
    for (const symbol of new Set(assets.map((asset) => asset.symbol))) rates.set(symbol, (await fetchCryptoBuyRate({ symbol })).data);

    const data = assets.map((asset) => {
        const rate = rates.get(asset.symbol) ?? null;
        const price = rate && asset.sendFee !== null
            ? priceCryptoPurchase({ rate: rate.rate, markupPercent: rate.markupPercent, networkFee: asset.sendFee, precision: asset.sendPrecision ?? 6, cryptoAmount: "1" })
            : null;
        return {
            id: asset.id,
            symbol: asset.symbol,
            network: asset.network,
            name: asset.name,
            memoRequired: asset.memoRequired,
            minAmount: asset.minSend === null ? null : new Decimal(asset.minSend).toFixed(),
            networkFee: asset.sendFee === null ? null : new Decimal(asset.sendFee).toFixed(),
            currency: CRYPTO_PURCHASES.CURRENCY,
            unitPrice: price?.unitPrice ?? null,
            isAvailable: price !== null,
        };
    });

    return { data };
};

export default fetchCryptoBuyAssets;
