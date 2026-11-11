import Decimal from "decimal.js";
import BreetClient from "./breetClient";
import { BreetAsset } from "./breetTypes";
import fetchBreetUsdRate from "./fetchBreetUsdRate";
import TtlCache from "./ttlCache";

const Precise = Decimal.clone({ precision: 40 });

/**
 * Breet's asset `minimum` is in USD ("Min. deposit (USD)" in its docs — $5,
 * $10 for some), not coin units. This turns it into coin units with Breet's
 * own rate calculator ($1 → cryptoAmount), rounded UP (to the cent from 1
 * coin up, else 3 significant digits) so the minimum we show is never below
 * Breet's. Cached per asset.
 */
class BreetMinDeposits {
    private readonly cache = new Map<string, TtlCache<string | null>>();

    constructor(
        private readonly client: BreetClient,
        private readonly assets: () => Promise<BreetAsset[]>,
        private readonly ttlMs: number,
        private readonly now: () => number,
    ) {}

    get(providerAssetId: string) {
        let entry = this.cache.get(providerAssetId);
        if (!entry) this.cache.set(providerAssetId, (entry = new TtlCache({ ttlMs: this.ttlMs, now: this.now })));
        return entry.get(() => this.load(providerAssetId));
    }

    private async load(providerAssetId: string) {
        const asset = (await this.assets()).find((candidate) => candidate.id === providerAssetId);
        if (!asset || typeof asset.minimum !== "number" || asset.minimum <= 0) return null;

        const perUsd = await fetchBreetUsdRate({ client: this.client, providerAssetId });
        const cryptoPerUsd = new Precise(perUsd.cryptoAmount);
        if (cryptoPerUsd.lte(0)) return null;

        const minimum = cryptoPerUsd.times(asset.minimum);
        // Up, never below Breet's: whole-ish amounts to the cent (10.02 USDT),
        // tiny ones to 3 significant digits (0.0000677 BTC).
        const rounded = minimum.gte(1) ? minimum.toDecimalPlaces(2, Decimal.ROUND_UP) : minimum.toSignificantDigits(3, Decimal.ROUND_UP);
        return rounded.toFixed();
    }
}

export default BreetMinDeposits;
