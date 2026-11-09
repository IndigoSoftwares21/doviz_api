import { db } from "@/database";

/** An enabled asset the given provider supports in this environment. */
const selectEnabledProviderAsset = async ({
    assetId,
    provider,
    environment,
}: {
    assetId: string;
    provider: string;
    environment: string;
}) => {
    const assetRow = await db
        .selectFrom("crypto_assets")
        .innerJoin("crypto_provider_assets", "crypto_provider_assets.assetId", "crypto_assets.id")
        .select([
            "crypto_assets.id",
            "crypto_assets.symbol",
            "crypto_assets.network",
            "crypto_assets.decimals",
            "crypto_provider_assets.providerAssetId",
            "crypto_provider_assets.providerCode",
        ])
        .where("crypto_assets.id", "=", assetId)
        .where("crypto_assets.isEnabled", "=", true)
        .where("crypto_provider_assets.isEnabled", "=", true)
        .where("crypto_provider_assets.provider", "=", provider)
        .where("crypto_provider_assets.environment", "=", environment)
        .executeTakeFirst();

    return assetRow;
};

export default selectEnabledProviderAsset;
