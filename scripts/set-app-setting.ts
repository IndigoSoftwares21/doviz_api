// scripts/set-app-setting.ts — npm run settings:set -- <key> <value>
// Sets a feature switch (see constants/appSettings). Audited; takes effect on the next request.
import * as dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env" });

import { db, disconnect } from "../src/database";
import createAuditLog from "../src/actions/auditLog/createAuditLog";
import AUDIT_ACTIONS from "../src/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "../src/constants/auditTargets";
import { APP_SETTINGS } from "../src/constants/appSettings";

const main = async () => {
    const [key, value] = process.argv.slice(2);
    const setting = APP_SETTINGS[key as keyof typeof APP_SETTINGS];
    if (!setting || !(setting.values as readonly string[]).includes(value)) {
        const list = Object.entries(APP_SETTINGS).map(([name, { values }]) => `  ${name}: ${values.join(" | ")}`).join("\n");
        throw new Error(`Usage: npm run settings:set -- <key> <value>\n${list}`);
    }
    await db.transaction().execute(async (trx) => {
        const previous = await trx.selectFrom("app_settings").select(["value"]).where("key", "=", key).executeTakeFirst();
        await trx.insertInto("app_settings").values({ key, value }).onConflict((oc) => oc.column("key").doUpdateSet({ value, updatedAt: new Date() })).execute();
        await createAuditLog({ trx, action: AUDIT_ACTIONS.APP_SETTING_CHANGED, actorType: AUDIT_ACTOR_TYPE.ADMIN, entityType: AUDIT_ENTITY_TYPE.APP_SETTING, metadata: { key, from: previous?.value ?? null, to: value } });
        console.log(`${key}: ${previous?.value ?? "none"} → ${value}`);
    });
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
