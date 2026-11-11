import { db } from "../../src/database";
import { CryptoProvider } from "../../src/services/crypto/cryptoProvider";
import SUPPORTED_ASSETS from "./supportedAssets";
import { ProviderEnvironment } from "../../src/constants/crypto";

/**
 * Upserts our coins, then maps the provider's assets onto them. Unmatched or
 * ambiguous provider assets are logged and skipped — never guessed.
 * Re-syncing never re-enables a coin someone switched off.
 */
const syncAssets = async ({ provider, environment }: { provider: CryptoProvider; environment: ProviderEnvironment }) => {
    const providerAssets = await provider.listAssets();

    for (const asset of SUPPORTED_ASSETS) {
        const row = await db
            .insertInto("crypto_assets")
            .values({ ...asset, isEnabled: true, isBuyEnabled: false })
            .onConflict((oc) => oc.columns(["symbol", "network"]).doUpdateSet({ name: asset.name, decimals: asset.decimals, updatedAt: new Date() }))
            .returning(["id"])
            .executeTakeFirstOrThrow();

        const matches = providerAssets.filter((candidate) => candidate.symbol === asset.symbol && candidate.network === asset.network);
        if (matches.length !== 1) {
            console.warn(`  ✗ ${asset.symbol}/${asset.network}: ${matches.length} ${provider.name} matches — skipped`);
            continue;
        }

        const [match] = matches;
        const mapping = {
            providerAssetId: match.providerAssetId,
            providerCode: match.providerCode,
            minDeposit: match.minDeposit,
            confirmations: match.confirmations,
            syncedAt: new Date(),
            updatedAt: new Date(),
        };
        await db
            .insertInto("crypto_provider_assets")
            .values({ assetId: row.id, provider: provider.name, environment, isEnabled: true, canSend: false, memoRequired: false, ...mapping })
            .onConflict((oc) => oc.columns(["provider", "environment", "assetId"]).doUpdateSet(mapping))
            .execute();
        console.log(`  ✓ ${asset.symbol}/${asset.network} → ${match.providerCode}`);
    }

    const ours = new Set(SUPPORTED_ASSETS.map((asset) => `${asset.symbol}/${asset.network}`));
    const ignored = providerAssets.filter((asset) => !ours.has(`${asset.symbol}/${asset.network}`));
    if (ignored.length) console.log(`  (ignored ${ignored.length} other ${provider.name} assets: ${ignored.map((a) => a.providerCode).join(", ")})`);
};

export default syncAssets;
