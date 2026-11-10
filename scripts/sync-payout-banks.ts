// scripts/sync-payout-banks.ts — npm run payouts:sync-banks [-- <provider>]
// Pulls a payout provider's bank list into our banks (matched by slug), with its own codes.
import * as dotenv from "dotenv";
dotenv.config();

import { disconnect } from "../src/database";
import payoutProviderRegistry from "../src/services/payouts/payoutProviderRegistry";
import registerPayoutProviders from "../src/services/payouts/providers";
import fetchActivePayoutProvider from "../src/actions/payoutProvider/fetchActivePayoutProvider";
import syncBanks from "./crypto/syncBanks";

const main = async () => {
    registerPayoutProviders();
    const provider = process.argv[2] ? payoutProviderRegistry.get({ name: process.argv[2] }) : (await fetchActivePayoutProvider()).data;
    console.log(`Syncing ${provider.name} (${provider.environment}) payout banks…`);
    await syncBanks({ provider, environment: provider.environment });
};

main()
    .then(() => console.log("✨ Payout banks synced"))
    .catch((error) => {
        console.error("Payout bank sync failed:", error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
