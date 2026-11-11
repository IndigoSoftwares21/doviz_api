import { db } from "@/database";

const COLUMNS = [
    "crypto_assets.id",
    "crypto_assets.symbol",
    "crypto_assets.network",
    "crypto_assets.name",
    "crypto_provider_assets.providerAssetId",
    "crypto_provider_assets.minSend",
    "crypto_provider_assets.sendFee",
    "crypto_provider_assets.sendPrecision",
    "crypto_provider_assets.memoRequired",
] as const;

/**
 * Buyable coins the given provider can send in this environment (all, or one
 * by id). Buying needs both our switch (is_buy_enabled) and the provider's
 * mapping (can_send) on.
 */
const selectBuyAssets = async ({ provider, environment, assetId }: { provider: string; environment: string; assetId?: string }) => {
    let query = db
        .selectFrom("crypto_assets")
        .innerJoin("crypto_provider_assets", "crypto_provider_assets.assetId", "crypto_assets.id")
        .select(COLUMNS)
        .where("crypto_assets.isBuyEnabled", "=", true)
        .where("crypto_provider_assets.canSend", "=", true)
        .where("crypto_provider_assets.isEnabled", "=", true)
        .where("crypto_provider_assets.provider", "=", provider)
        .where("crypto_provider_assets.environment", "=", environment);
    if (assetId) query = query.where("crypto_assets.id", "=", assetId);

    const assetRows = await query.orderBy("crypto_assets.symbol").orderBy("crypto_assets.network").execute();

    return assetRows;
};

export type BuyAssetRow = Awaited<ReturnType<typeof selectBuyAssets>>[number];

export default selectBuyAssets;
