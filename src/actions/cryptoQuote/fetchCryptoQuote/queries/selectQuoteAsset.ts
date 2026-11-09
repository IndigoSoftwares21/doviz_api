import { db } from "@/database";

const selectQuoteAsset = async ({
    assetId,
    provider,
    environment,
}: {
    assetId: string;
    provider: string;
    environment: string;
}) => {
    const assetRow = await db
        .selectFrom("crypto_provider_assets")
        .select(["providerAssetId"])
        .where("assetId", "=", assetId)
        .where("provider", "=", provider)
        .where("environment", "=", environment)
        .executeTakeFirstOrThrow();

    return assetRow;
};

export default selectQuoteAsset;
