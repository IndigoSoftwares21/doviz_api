// scripts/set-payout-fee.ts — npm run payouts:set-fee -- <provider> <fixed fee> [--vat 7.5] [--env production|sandbox]
// Sets a payout provider's default fee (used when it can't quote one; the quote
// reserves the higher of this and its recent real fees). Audited.
import * as dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env" }); // .env.production under the :prod commands

import Decimal from "decimal.js";
import { db, disconnect } from "../src/database";
import createAuditLog from "../src/actions/auditLog/createAuditLog";
import isNairaAmount from "../src/utils/money/isNairaAmount";
import parseFlags from "./crypto-buy/parseFlags";
import AUDIT_ACTIONS from "../src/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "../src/constants/auditTargets";

const USAGE = "Usage: npm run payouts:set-fee -- <provider> <fixed fee, e.g. 50.00> [--vat 7.5] [--env production|sandbox]";

const main = async () => {
    const { positional, flags } = parseFlags(process.argv.slice(2));
    const [provider, fixedFee] = positional;
    const vat = typeof flags.vat === "string" ? flags.vat : "7.5";
    const environment = typeof flags.env === "string" ? flags.env : "production";
    if (!provider || !fixedFee || !(isNairaAmount({ value: fixedFee }) || fixedFee === "0")) throw new Error(USAGE);
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(vat) || !["production", "sandbox"].includes(environment)) throw new Error(USAGE);

    const fee = new Decimal(fixedFee).toFixed(2);
    await db.transaction().execute(async (trx) => {
        const previous = await trx.selectFrom("payout_fee_defaults").select(["fixedFee", "vatPercent"])
            .where("provider", "=", provider).where("environment", "=", environment).where("currency", "=", "NGN").executeTakeFirst();
        await trx
            .insertInto("payout_fee_defaults")
            .values({ provider, environment, currency: "NGN", fixedFee: fee, vatPercent: vat })
            .onConflict((oc) => oc.columns(["provider", "environment", "currency"]).doUpdateSet({ fixedFee: fee, vatPercent: vat, updatedAt: new Date() }))
            .execute();
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.PAYOUT_FEE_DEFAULT_SET,
            actorType: AUDIT_ACTOR_TYPE.ADMIN,
            entityType: AUDIT_ENTITY_TYPE.PROVIDER_SETTING,
            metadata: { provider, environment, from: previous ?? null, to: { fixedFee: fee, vatPercent: vat } },
        });
    });
    const total = new Decimal(fee).times(new Decimal(100).plus(vat)).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_UP);
    console.log(`${provider} (${environment}): ₦${fee} + ${vat}% VAT = ₦${total.toFixed(2)} default payout fee`);
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
