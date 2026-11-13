// scripts/set-kyc-level.ts — npm run kyc:level -- <bvn|bvn_selfie>
// Switches which checks identity verification runs, for everyone, no app release:
//   bvn        → BVN details (names, date of birth) + the user's verified phone
//   bvn_selfie → plus a selfie matched to the official BVN photo
// The app draws whatever the form asks for. Verified users stay verified.
import * as dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env" });

import { db, disconnect } from "../src/database";
import createAuditLog from "../src/actions/auditLog/createAuditLog";
import AUDIT_ACTIONS from "../src/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "../src/constants/auditTargets";
import { KYC_LEVEL_SETTING } from "../src/constants/kyc";
import { KYC_FORMS } from "../src/constants/kycFields";

const main = async () => {
    const level = process.argv[2];
    if (!level || !KYC_FORMS[level]) throw new Error(`Usage: npm run kyc:level -- <${Object.keys(KYC_FORMS).join("|")}>`);

    await db.transaction().execute(async (trx) => {
        const previous = await trx.selectFrom("app_settings").select(["value"]).where("key", "=", KYC_LEVEL_SETTING).executeTakeFirst();
        await trx
            .insertInto("app_settings")
            .values({ key: KYC_LEVEL_SETTING, value: level })
            .onConflict((oc) => oc.column("key").doUpdateSet({ value: level, updatedAt: new Date() }))
            .execute();
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.APP_SETTING_CHANGED,
            actorType: AUDIT_ACTOR_TYPE.ADMIN,
            entityType: AUDIT_ENTITY_TYPE.APP_SETTING,
            metadata: { key: KYC_LEVEL_SETTING, from: previous?.value ?? null, to: level },
        });
        console.log(`KYC level: ${previous?.value ?? "none"} → ${level} (asks for: ${KYC_FORMS[level].required.join(", ")})`);
    });
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
