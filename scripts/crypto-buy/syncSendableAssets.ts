import { db } from "../../src/database";
import { CryptoSendProvider } from "../../src/services/cryptoSends/cryptoSendProvider";
import { BUYABLE_ASSETS, PROVIDER_NETWORK_ALIASES } from "./buyableAssets";

/**
 * Upserts our buyable coins, then maps the provider's sendable assets onto
 * them (fee, minimum, precision, memo). New coins start buy-enabled but NOT
 * sell-enabled. A re-sync never switches buying on for an existing coin
 * unless `enable` is passed (--enable) — so one someone switched off stays off.
 * Unmatched / ambiguous provider assets are logged and skipped.
 */
const syncSendableAssets = async ({ provider, enable = false }: { provider: CryptoSendProvider; enable?: boolean }) => {
    const aliases = PROVIDER_NETWORK_ALIASES[provider.name] ?? {};
    const sendable = await provider.listSendableAssets();
    const ours = (network: string) => aliases[network] ?? null;

    for (const asset of BUYABLE_ASSETS) {
        const row = await db
            .insertInto("crypto_assets")
            .values({ ...asset, isEnabled: false, isBuyEnabled: true })
            .onConflict((oc) => oc.columns(["symbol", "network"]).doUpdateSet(enable ? { isBuyEnabled: true, updatedAt: new Date() } : { updatedAt: new Date() }))
            .returning(["id", "isBuyEnabled"])
            .executeTakeFirstOrThrow();

        const matches = sendable.filter((candidate) => candidate.symbol === asset.symbol && ours(candidate.providerNetwork) === asset.network);
        if (matches.length !== 1) {
            console.warn(`  ✗ ${asset.symbol}/${asset.network}: ${matches.length} ${provider.name} matches — skipped`);
            continue;
        }

        const [match] = matches;
        const terms = { minSend: match.terms.minAmount, sendFee: match.terms.fee, sendPrecision: match.terms.precision, memoRequired: match.terms.memoRequired, syncedAt: new Date(), updatedAt: new Date() };
        await db
            .insertInto("crypto_provider_assets")
            .values({ assetId: row.id, provider: provider.name, environment: provider.environment, providerAssetId: match.providerAssetId, providerCode: match.providerCode, isEnabled: true, canSend: true, ...terms })
            .onConflict((oc) => oc.columns(["provider", "environment", "assetId"]).doUpdateSet({ providerAssetId: match.providerAssetId, providerCode: match.providerCode, ...terms }))
            .execute();
        const paused = match.terms.isEnabled ? "" : " (provider has sends paused right now)";
        const off = row.isBuyEnabled ? "" : " — buying is OFF for this coin (re-run with --enable to switch it on)";
        console.log(`  ✓ ${asset.symbol}/${asset.network} → ${match.providerAssetId}: fee ${match.terms.fee}, min ${match.terms.minAmount}${paused}${off}`);
    }

    const unmapped = sendable.filter((candidate) => !ours(candidate.providerNetwork));
    if (unmapped.length) console.log(`  (no alias for ${unmapped.map((a) => a.providerAssetId).join(", ")} — add to PROVIDER_NETWORK_ALIASES to use)`);
};

export default syncSendableAssets;
