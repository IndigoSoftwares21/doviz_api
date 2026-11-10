// scripts/sync-bill-catalog.ts — npm run bills:sync [-- <provider>]
import * as dotenv from "dotenv";
dotenv.config();

import { disconnect } from "../src/database";
import billProviderRegistry from "../src/services/bills/billProviderRegistry";
import registerBillProviders from "../src/services/bills/providers";
import syncBillCatalog from "./bills/syncBillCatalog";

const main = async () => {
    registerBillProviders();
    const provider = process.argv[2] ? billProviderRegistry.get({ name: process.argv[2] }) : billProviderRegistry.active();

    console.log(`Syncing ${provider.name} (${provider.environment}) bill catalog…`);
    await syncBillCatalog({ provider });
};

main()
    .then(() => console.log("✨ Bill catalog synced"))
    .catch((error) => {
        console.error("Bill catalog sync failed:", error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
