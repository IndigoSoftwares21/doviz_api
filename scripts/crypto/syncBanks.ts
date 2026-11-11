import { db } from "../../src/database";
import { ProviderBank } from "../../src/services/crypto/types";
import { ProviderEnvironment } from "../../src/constants/crypto";
import resolvePayoutBank from "./resolvePayoutBank";

/** Any provider with a bank list (crypto or payout). */
interface BankListProvider {
    readonly name: string;
    listBanks(): Promise<ProviderBank[]>;
}

/**
 * Maps the provider's bank list onto our banks (by code, else name — see
 * resolvePayoutBank) for this environment. Re-runnable: a provider bank id
 * that moved to another of our banks is re-pointed; two provider entries for
 * the same bank keep the first (logged), never break the sync.
 */
const syncBanks = async ({ provider, environment }: { provider: BankListProvider; environment: ProviderEnvironment }) => {
    const banks = await provider.listBanks();
    const mapped = new Set<string>();
    const skipped: string[] = [];

    for (const bank of banks) {
        const payoutBankId = await resolvePayoutBank({ bank });
        if (mapped.has(payoutBankId)) {
            skipped.push(`${bank.name} (${bank.providerBankId})`);
            continue;
        }
        mapped.add(payoutBankId);

        await db.transaction().execute(async (trx) => {
            // Free this provider bank id if an earlier sync gave it to another of our banks.
            await trx
                .deleteFrom("provider_banks")
                .where("provider", "=", provider.name)
                .where("environment", "=", environment)
                .where("providerBankId", "=", bank.providerBankId)
                .where("payoutBankId", "<>", payoutBankId)
                .execute();
            await trx
                .insertInto("provider_banks")
                .values({ payoutBankId, provider: provider.name, environment, providerBankId: bank.providerBankId, syncedAt: new Date() })
                .onConflict((oc) => oc.columns(["provider", "environment", "payoutBankId"]).doUpdateSet({ providerBankId: bank.providerBankId, syncedAt: new Date() }))
                .execute();
        });
    }

    console.log(`  ✓ ${mapped.size} banks synced from ${provider.name} (${environment})`);
    if (skipped.length) console.log(`  (duplicates of a bank already mapped, skipped: ${skipped.join(", ")})`);
};

export default syncBanks;
