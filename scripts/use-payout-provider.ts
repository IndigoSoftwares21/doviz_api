// scripts/use-payout-provider.ts — npm run payouts:use -- <provider>
// Switches the provider for NEW withdrawals. In-flight ones finish with their own provider.
import * as dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env" }); // .env.production under the :prod commands

import { db, disconnect } from "../src/database";
import payoutProviderRegistry from "../src/services/payouts/payoutProviderRegistry";
import registerPayoutProviders from "../src/services/payouts/providers";
import createAuditLog from "../src/actions/auditLog/createAuditLog";
import AUDIT_ACTIONS from "../src/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "../src/constants/auditTargets";
import { PROVIDER_SERVICE } from "../src/constants/withdrawals";

const main = async () => {
    const name = process.argv[2];
    registerPayoutProviders();
    if (!name || !payoutProviderRegistry.has({ name })) {
        throw new Error(`Usage: npm run payouts:use -- <provider>. Configured: ${payoutProviderRegistry.names().join(", ") || "none"}`);
    }
    const provider = payoutProviderRegistry.get({ name });

    const banks = await db
        .selectFrom("provider_banks")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("provider", "=", name)
        .where("environment", "=", provider.environment)
        .executeTakeFirstOrThrow();
    if (Number(banks.count) === 0) throw new Error(`${name} has no banks synced for ${provider.environment} — run npm run payouts:sync-banks -- ${name} first`);

    await db.transaction().execute(async (trx) => {
        const previous = await trx.selectFrom("provider_settings").select(["activeProvider"]).where("service", "=", PROVIDER_SERVICE.PAYOUTS).executeTakeFirst();
        await trx
            .insertInto("provider_settings")
            .values({ service: PROVIDER_SERVICE.PAYOUTS, activeProvider: name })
            .onConflict((oc) => oc.column("service").doUpdateSet({ activeProvider: name, updatedAt: new Date() }))
            .execute();
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.PROVIDER_SWITCHED,
            actorType: AUDIT_ACTOR_TYPE.ADMIN,
            entityType: AUDIT_ENTITY_TYPE.PROVIDER_SETTING,
            metadata: { service: PROVIDER_SERVICE.PAYOUTS, from: previous?.activeProvider ?? null, to: name },
        });
        console.log(`Payouts: ${previous?.activeProvider ?? "none"} → ${name}`);
    });
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
