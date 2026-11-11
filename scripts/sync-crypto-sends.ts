// scripts/sync-crypto-sends.ts — npm run crypto-sends:sync [-- <provider>] [--enable]
// Maps a crypto-send provider's coins/networks onto ours (default: the active provider).
import * as dotenv from "dotenv";
dotenv.config();

import { db, disconnect } from "../src/database";
import cryptoSendProviderRegistry from "../src/services/cryptoSends/cryptoSendProviderRegistry";
import registerCryptoSendProviders from "../src/services/cryptoSends/providers";
import syncSendableAssets from "./crypto-buy/syncSendableAssets";
import { PROVIDER_SERVICE } from "../src/constants/withdrawals";

const main = async () => {
    registerCryptoSendProviders();
    const active = await db.selectFrom("provider_settings").select(["activeProvider"]).where("service", "=", PROVIDER_SERVICE.CRYPTO_SENDS).executeTakeFirst();
    const args = process.argv.slice(2);
    const name = args.find((arg) => !arg.startsWith("--")) ?? active?.activeProvider;
    if (!name || !cryptoSendProviderRegistry.has({ name })) {
        throw new Error(`Usage: npm run crypto-sends:sync -- <provider>. Configured: ${cryptoSendProviderRegistry.names().join(", ") || "none"}`);
    }
    const provider = cryptoSendProviderRegistry.get({ name });
    console.log(`Syncing ${name} (${provider.environment})…`);
    await syncSendableAssets({ provider, enable: args.includes("--enable") });
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
