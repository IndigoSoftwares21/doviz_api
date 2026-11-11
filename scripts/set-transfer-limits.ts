// scripts/set-transfer-limits.ts — npm run transfers:set-limits -- [--daily 1000000] [--max 1000000] [--min 100] [--note "…"]
// Changes the Ziks-to-Ziks sending limits (scope 'default'). Applies to the
// very next transfer — no deploy. Audited with the before and after values.
import * as dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env" }); // .env.production under the :prod commands

import Decimal from "decimal.js";
import { db, disconnect } from "../src/database";
import createAuditLog from "../src/actions/auditLog/createAuditLog";
import isNairaAmount from "../src/utils/money/isNairaAmount";
import parseFlags from "./crypto-buy/parseFlags";
import TRANSFERS from "../src/constants/transfers";
import AUDIT_ACTIONS from "../src/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "../src/constants/auditTargets";

const USAGE = "Usage: npm run transfers:set-limits -- [--daily <naira>] [--max <naira per transfer>] [--min <naira>] [--note \"why\"]";

const amountFlag = (value: unknown) => {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || !isNairaAmount({ value })) throw new Error(USAGE);
    return new Decimal(value).toFixed(2);
};

const main = async () => {
    const { flags } = parseFlags(process.argv.slice(2));
    const changes = { maxPerDay: amountFlag(flags.daily), maxPerTransfer: amountFlag(flags.max), minAmount: amountFlag(flags.min) };
    if (Object.values(changes).every((value) => value === undefined)) throw new Error(USAGE);
    const note = typeof flags.note === "string" ? flags.note.slice(0, 255) : null;
    const where = { scope: TRANSFERS.DEFAULT_SCOPE, currency: TRANSFERS.CURRENCY };

    const after = await db.transaction().execute(async (trx) => {
        const before = await trx.selectFrom("transfer_limits").select(["minAmount", "maxPerTransfer", "maxPerDay"])
            .where("scope", "=", where.scope).where("currency", "=", where.currency).forUpdate().executeTakeFirstOrThrow();
        const next = {
            minAmount: changes.minAmount ?? before.minAmount,
            maxPerTransfer: changes.maxPerTransfer ?? before.maxPerTransfer,
            maxPerDay: changes.maxPerDay ?? before.maxPerDay,
        };
        if (new Decimal(next.maxPerTransfer).lessThan(next.minAmount) || new Decimal(next.maxPerDay).lessThan(next.minAmount)) {
            throw new Error("The minimum can't be more than the per-transfer or daily limit");
        }
        await trx.updateTable("transfer_limits").set({ ...next, updatedBy: "ops-script", updatedAt: new Date() })
            .where("scope", "=", where.scope).where("currency", "=", where.currency).execute();
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.TRANSFER_LIMITS_SET,
            actorType: AUDIT_ACTOR_TYPE.ADMIN,
            entityType: AUDIT_ENTITY_TYPE.TRANSFER_LIMIT,
            metadata: { ...where, from: before, to: next, note },
        });
        return next;
    });
    console.log(`Transfer limits (${where.scope}): min ₦${after.minAmount}, ₦${after.maxPerTransfer} per transfer, ₦${after.maxPerDay} per 24 hours`);
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
