// scripts/set-conversion-markup.ts — npm run crypto:set-markup -- <SYMBOL> <NETWORK> <percent> [note]
import * as dotenv from "dotenv";
dotenv.config();

import { db, disconnect } from "../src/database";

/**
 * Adds a new markup for a coin, effective now. Markups are append-only history:
 * past deposits keep the markup they were credited with.
 */
const main = async () => {
    const [symbol, network, percent, ...noteParts] = process.argv.slice(2);
    if (!symbol || !network || !percent) {
        throw new Error("Usage: npm run crypto:set-markup -- <SYMBOL> <NETWORK> <percent> [note]");
    }
    if (!/^\d{1,2}(\.\d{1,3})?$/.test(percent) || Number(percent) > 20) {
        throw new Error("Markup must be a percentage between 0 and 20 with at most 3 decimals");
    }

    const asset = await db
        .selectFrom("crypto_assets")
        .select(["id"])
        .where("symbol", "=", symbol.toUpperCase())
        .where("network", "=", network.toUpperCase())
        .executeTakeFirst();
    if (!asset) throw new Error(`Unknown asset ${symbol}/${network} — run npm run crypto:sync first`);

    const row = await db
        .insertInto("conversion_markups")
        .values({ assetId: asset.id, currency: "NGN", markupPercent: percent, note: noteParts.join(" ") || null })
        .returning(["markupPercent", "effectiveFrom"])
        .executeTakeFirstOrThrow();

    console.log(`✓ ${symbol.toUpperCase()}/${network.toUpperCase()} markup ${row.markupPercent}% effective ${row.effectiveFrom.toISOString()}`);
};

main()
    .catch((error) => {
        console.error("Setting markup failed:", error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
