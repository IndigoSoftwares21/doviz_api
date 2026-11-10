import { db } from "../../src/database";
import { ProviderBank } from "../../src/services/crypto/types";
import { ProviderEnvironment } from "../../src/constants/crypto";

/** Upserts the provider's bank list (matched by slug) into the neutral bank table and its mapping. */
/** Any provider with a bank list (crypto or payout). */
interface BankListProvider {
    readonly name: string;
    listBanks(): Promise<ProviderBank[]>;
}

const syncBanks = async ({ provider, environment }: { provider: BankListProvider; environment: ProviderEnvironment }) => {
    const banks = await provider.listBanks();

    for (const bank of banks) {
        const row = await db
            .insertInto("payout_banks")
            .values({ name: bank.name, slug: bank.slug, code: bank.code, isEnabled: true })
            .onConflict((oc) =>
                oc.column("slug").doUpdateSet((eb) => ({
                    name: bank.name,
                    // Never let a provider without codes erase a real one.
                    code: eb.fn.coalesce("excluded.code", "payout_banks.code"),
                    updatedAt: new Date(),
                })),
            )
            .returning(["id"])
            .executeTakeFirstOrThrow();

        await db
            .insertInto("provider_banks")
            .values({ payoutBankId: row.id, provider: provider.name, environment, providerBankId: bank.providerBankId, syncedAt: new Date() })
            .onConflict((oc) =>
                oc.columns(["provider", "environment", "payoutBankId"]).doUpdateSet({ providerBankId: bank.providerBankId, syncedAt: new Date() }),
            )
            .execute();
    }

    console.log(`  ✓ ${banks.length} banks synced from ${provider.name}`);
};

export default syncBanks;
