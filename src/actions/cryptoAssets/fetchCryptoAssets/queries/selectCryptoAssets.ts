import { db } from "@/database";

const selectCryptoAssets = async ({ provider, environment }: { provider: string; environment: string }) => {
    const assetRows = await db
        .selectFrom("crypto_assets")
        .innerJoin("crypto_provider_assets", "crypto_provider_assets.assetId", "crypto_assets.id")
        .select([
            "crypto_assets.id",
            "crypto_assets.symbol",
            "crypto_assets.network",
            "crypto_assets.name",
            "crypto_provider_assets.providerAssetId",
            "crypto_provider_assets.minDeposit",
            "crypto_provider_assets.confirmations",
        ])
        .where("crypto_assets.isEnabled", "=", true)
        .where("crypto_provider_assets.isEnabled", "=", true)
        .where("crypto_provider_assets.provider", "=", provider)
        .where("crypto_provider_assets.environment", "=", environment)
        .orderBy("crypto_assets.symbol")
        .orderBy("crypto_assets.network")
        .execute();

    return assetRows;
};

export default selectCryptoAssets;
