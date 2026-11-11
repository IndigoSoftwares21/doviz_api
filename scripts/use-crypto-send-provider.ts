// scripts/use-crypto-send-provider.ts — npm run crypto-sends:use -- <provider>
// Switches the provider for NEW crypto purchases. In-flight ones finish with their own provider.
import * as dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env" }); // .env.production under the :prod commands

import { db, disconnect } from "../src/database";
import cryptoSendProviderRegistry from "../src/services/cryptoSends/cryptoSendProviderRegistry";
import registerCryptoSendProviders from "../src/services/cryptoSends/providers";
import createAuditLog from "../src/actions/auditLog/createAuditLog";
import AUDIT_ACTIONS from "../src/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "../src/constants/auditTargets";
import { PROVIDER_SERVICE } from "../src/constants/withdrawals";

const main = async () => {
    const name = process.argv[2];
    registerCryptoSendProviders();
    if (!name || !cryptoSendProviderRegistry.has({ name })) {
        throw new Error(`Usage: npm run crypto-sends:use -- <provider>. Configured: ${cryptoSendProviderRegistry.names().join(", ") || "none"}`);
    }
    const provider = cryptoSendProviderRegistry.get({ name });

    const assets = await db
        .selectFrom("crypto_provider_assets")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("provider", "=", name)
        .where("environment", "=", provider.environment)
        .where("canSend", "=", true)
        .executeTakeFirstOrThrow();
    if (Number(assets.count) === 0) throw new Error(`${name} has no coins synced for ${provider.environment} — run npm run crypto-sends:sync -- ${name} first`);

    await db.transaction().execute(async (trx) => {
        const service = PROVIDER_SERVICE.CRYPTO_SENDS;
        const previous = await trx.selectFrom("provider_settings").select(["activeProvider"]).where("service", "=", service).executeTakeFirst();
        await trx
            .insertInto("provider_settings")
            .values({ service, activeProvider: name })
            .onConflict((oc) => oc.column("service").doUpdateSet({ activeProvider: name, updatedAt: new Date() }))
            .execute();
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.PROVIDER_SWITCHED,
            actorType: AUDIT_ACTOR_TYPE.ADMIN,
            entityType: AUDIT_ENTITY_TYPE.PROVIDER_SETTING,
            metadata: { service, from: previous?.activeProvider ?? null, to: name },
        });
        console.log(`Crypto sends: ${previous?.activeProvider ?? "none"} → ${name}`);
    });
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
