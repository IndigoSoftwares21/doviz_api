import Decimal from "decimal.js";
import fetchActiveCryptoSendProvider from "@/actions/cryptoSendProvider/fetchActiveCryptoSendProvider";
import fetchCryptoBuyPrice, { CryptoBuyPrice } from "@/actions/cryptoBuyPrice/fetchCryptoBuyPrice";
import selectBuyAssets from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote/queries/selectBuyAsset";
import priceCryptoPurchase from "@/utils/cryptoPurchases/priceCryptoPurchase";
import fetchCryptoStock, { CryptoStock } from "@/utils/cryptoPurchases/fetchCryptoStock";
import maxSendable from "@/utils/cryptoPurchases/maxSendable";
import fetchLiveSendTerms from "@/utils/cryptoPurchases/fetchLiveSendTerms";
import CRYPTO_PURCHASES from "@/constants/cryptoPurchases";

/**
 * Coins the user can buy right now, each with its network fee and minimum
 * (live from the provider; the synced catalog only if it can't be reached), the
 * most one purchase can deliver, and our current unit price (a rate we set,
 * or from the market). Only coins we hold enough of are listed: a network
 * whose stock can't cover its minimum send (plus fee) is left out, and a coin
 * with no such network disappears. A coin without a price is listed as
 * unavailable (so the app can say so) rather than hidden. A network the
 * provider has paused is hidden.
 */
const fetchCryptoBuyAssets = async () => {
    const { data: provider } = await fetchActiveCryptoSendProvider();
    if (!provider) return { data: [] };

    const assets = await selectBuyAssets({ provider: provider.name, environment: provider.environment });
    const live = await fetchLiveSendTerms({ provider });
    const rates = new Map<string, CryptoBuyPrice | null>();
    const stocks = new Map<string, CryptoStock>();
    for (const asset of assets) {
        if (rates.has(asset.symbol)) continue;
        rates.set(asset.symbol, (await fetchCryptoBuyPrice({ provider, symbol: asset.symbol })).data);
        stocks.set(asset.symbol, await fetchCryptoStock({ provider, symbol: asset.symbol, providerAssetId: asset.providerAssetId }));
    }

    const data = assets.flatMap((asset) => {
        const terms = live?.get(asset.providerAssetId);
        if (terms && !terms.isEnabled) return []; // the provider has sends on this network paused
        const fee = terms?.fee ?? asset.sendFee;
        const minSend = terms?.minAmount ?? asset.minSend;
        if (fee === null || minSend === null) return [];
        const precision = terms?.precision ?? asset.sendPrecision ?? 6;
        const maxAmount = maxSendable({ stock: stocks.get(asset.symbol)!, fee, precision });
        if (maxAmount !== null && new Decimal(maxAmount).lessThan(minSend)) return [];

        const rate = rates.get(asset.symbol) ?? null;
        const pricing = rate ? { rate: rate.rate, markupPercent: rate.markupPercent, networkFee: fee, precision } : null;
        const price = pricing ? priceCryptoPurchase({ ...pricing, cryptoAmount: "1" }) : null;
        const most = pricing && maxAmount !== null ? priceCryptoPurchase({ ...pricing, cryptoAmount: maxAmount }) : null;
        return [{
            id: asset.id,
            symbol: asset.symbol,
            network: asset.network,
            name: asset.name,
            memoRequired: asset.memoRequired || terms?.memoRequired === true,
            minAmount: new Decimal(minSend).toFixed(),
            /** The most coin one purchase can deliver right now (null = no stock cap). */
            maxAmount,
            networkFee: new Decimal(fee).toFixed(),
            currency: CRYPTO_PURCHASES.CURRENCY,
            unitPrice: price?.unitPrice ?? null,
            /** The most naira one purchase can spend on this network right now. */
            maxTotal: most ? Decimal.min(most.total, CRYPTO_PURCHASES.MAX_TOTAL).toFixed(2) : price ? CRYPTO_PURCHASES.MAX_TOTAL : null,
            isAvailable: price !== null,
        }];
    });

    return { data };
};

export default fetchCryptoBuyAssets;
