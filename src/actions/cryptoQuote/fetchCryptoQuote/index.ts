import CRYPTO from "@/constants/crypto";
import providerRegistry from "@/services/crypto/providerRegistry";
import getProviderEnvironment from "@/utils/crypto/getProviderEnvironment";
import getCachedValue from "@/utils/crypto/getCachedValue";
import calculateMarkup from "@/utils/money/calculateMarkup";
import selectCurrentConversionMarkup from "./queries/selectCurrentConversionMarkup";
import selectQuoteAsset from "./queries/selectQuoteAsset";
import ACTION_FAILURE from "@/constants/actionFailure";

/**
 * Estimated naira for a crypto amount: the provider's conversion (after its
 * own fee) minus Doviz's current markup for the coin. Never defaults the
 * markup: with none configured, conversions are unavailable.
 */
const fetchCryptoQuote = async ({ assetId, cryptoAmount }: { assetId: string; cryptoAmount: string }) => {
    const provider = providerRegistry.active();
    const markup = await selectCurrentConversionMarkup({ assetId, currency: CRYPTO.CURRENCY, at: new Date() });

    if (!markup) {
        return { data: null, failure: ACTION_FAILURE.MARKUP_MISSING };
    }

    const asset = await selectQuoteAsset({ assetId, provider: provider.name, environment: getProviderEnvironment() });
    const { value: quote, expiresAt } = await getCachedValue({
        key: `quote:${provider.name}:${assetId}:${cryptoAmount}`,
        ttlSeconds: CRYPTO.QUOTE_TTL_SECONDS,
        load: () => provider.getQuote({ providerAssetId: asset.providerAssetId, cryptoAmount }),
    });
    const { markupNgn, netNgn } = calculateMarkup({ grossNgn: quote.grossNgn, markupPercent: markup.markupPercent });

    const data = {
        assetId,
        cryptoAmount,
        grossNgn: quote.grossNgn,
        markupPercent: markup.markupPercent,
        markupNgn,
        netNgn,
        rateNgnPerUsd: quote.rateNgnPerUsd,
        expiresAt,
        isEstimate: true,
    };

    return { data, failure: null };
};

export default fetchCryptoQuote;
