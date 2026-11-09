// scripts/sync-crypto-catalog.ts — npm run crypto:sync [-- <provider>]
import * as dotenv from "dotenv";
dotenv.config();

import { disconnect } from "../src/database";
import providerRegistry from "../src/services/crypto/providerRegistry";
import registerCryptoProviders from "../src/services/crypto/providers";
import syncAssets from "./crypto/syncAssets";
import syncBanks from "./crypto/syncBanks";
import CRYPTO from "../src/constants/crypto";

const main = async () => {
    const providerName = process.argv[2] ?? CRYPTO.DEFAULT_PROVIDER;

    registerCryptoProviders();
    const provider = providerRegistry.get({ name: providerName });
    const { environment } = provider;

    console.log(`Syncing ${provider.name} (${environment}) assets…`);
    await syncAssets({ provider, environment });
    console.log(`Syncing ${provider.name} (${environment}) banks…`);
    await syncBanks({ provider, environment });
};

main()
    .then(() => console.log("✨ Crypto catalog synced"))
    .catch((error) => {
        console.error("Crypto catalog sync failed:", error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
