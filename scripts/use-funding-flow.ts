// scripts/use-funding-flow.ts — npm run funding:use -- <squad|korapay>
// Switches the Add money flow for everyone, no app release needed:
//   squad   → account number (verify once, personal account number)
//   korapay → bank transfer (one-time account per top-up)
// Top-ups already started finish normally either way.
import * as dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env" });

import { db, disconnect } from "../src/database";
import createAuditLog from "../src/actions/auditLog/createAuditLog";
import AUDIT_ACTIONS from "../src/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "../src/constants/auditTargets";
import { PROVIDER_SERVICE } from "../src/constants/withdrawals";
import { NAIRA_FUNDING_PROVIDERS } from "../src/constants/nairaFunding";

const main = async () => {
    const name = process.argv[2];
    if (!name || !NAIRA_FUNDING_PROVIDERS[name]) {
        throw new Error(`Usage: npm run funding:use -- <${Object.keys(NAIRA_FUNDING_PROVIDERS).join("|")}>`);
    }

    await db.transaction().execute(async (trx) => {
        const previous = await trx.selectFrom("provider_settings").select(["activeProvider"]).where("service", "=", PROVIDER_SERVICE.NAIRA_FUNDING).executeTakeFirst();
        await trx
            .insertInto("provider_settings")
            .values({ service: PROVIDER_SERVICE.NAIRA_FUNDING, activeProvider: name })
            .onConflict((oc) => oc.column("service").doUpdateSet({ activeProvider: name, updatedAt: new Date() }))
            .execute();
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.PROVIDER_SWITCHED,
            actorType: AUDIT_ACTOR_TYPE.ADMIN,
            entityType: AUDIT_ENTITY_TYPE.PROVIDER_SETTING,
            metadata: { service: PROVIDER_SERVICE.NAIRA_FUNDING, from: previous?.activeProvider ?? null, to: name },
        });
        console.log(`Add money: ${previous?.activeProvider ?? "none"} → ${name} (${NAIRA_FUNDING_PROVIDERS[name]})`);
    });
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
