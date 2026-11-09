import { db } from "@/database";

const selectWalletAsset = async ({
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
            "crypto_assets.symbol",
            "crypto_assets.network",
            "crypto_provider_assets.providerAssetId",
            "crypto_provider_assets.providerCode",
        ])
        .where("crypto_assets.id", "=", assetId)
        .where("crypto_provider_assets.provider", "=", provider)
        .where("crypto_provider_assets.environment", "=", environment)
        .executeTakeFirstOrThrow();

    return assetRow;
};

export default selectWalletAsset;
