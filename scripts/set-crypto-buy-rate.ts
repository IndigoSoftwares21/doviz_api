// scripts/set-crypto-buy-rate.ts — npm run crypto:set-rate -- USDT 1650 [--markup 1.5] [--hours 24] [--note "…"] [--force]
// Sets our naira price per coin for buying. Append-only; expires (buying pauses) after --hours.
import * as dotenv from "dotenv";
dotenv.config();

import { userInfo } from "os";
import Decimal from "decimal.js";
import { db, disconnect } from "../src/database";
import createAuditLog from "../src/actions/auditLog/createAuditLog";
import parseFlags from "./crypto-buy/parseFlags";
import AUDIT_ACTIONS from "../src/constants/auditActions";
import CRYPTO_PURCHASES from "../src/constants/cryptoPurchases";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "../src/constants/auditTargets";

const USAGE = 'Usage: npm run crypto:set-rate -- <SYMBOL> <naira per coin> [--markup 1.5] [--hours 24] [--note "…"] [--force]';

const main = async () => {
    const { positional, flags } = parseFlags(process.argv.slice(2));
    const [rawSymbol, rawRate] = positional;
    if (!rawSymbol || !rawRate || !/^\d+(\.\d{1,8})?$/.test(rawRate) || new Decimal(rawRate).lte(0)) throw new Error(USAGE);
    const symbol = rawSymbol.toUpperCase();
    const markup = typeof flags.markup === "string" ? flags.markup : "0";
    const hours = typeof flags.hours === "string" ? Number(flags.hours) : CRYPTO_PURCHASES.DEFAULT_RATE_HOURS;
    if (!(hours > 0 && hours <= 24 * 7)) throw new Error("--hours must be between 0 and 168");

    const previous = await db.selectFrom("crypto_buy_rates").select(["rate"]).where("symbol", "=", symbol).orderBy("effectiveFrom", "desc").limit(1).executeTakeFirst();
    if (previous && flags.force !== true) {
        const change = new Decimal(rawRate).minus(previous.rate).abs().dividedBy(previous.rate).times(100);
        if (change.greaterThan(CRYPTO_PURCHASES.MAX_RATE_CHANGE_PERCENT)) {
            throw new Error(`${symbol} ${previous.rate} → ${rawRate} is a ${change.toFixed(1)}% change. Check for a typo, or add --force.`);
        }
    }

    const now = new Date();
    await db.transaction().execute(async (trx) => {
        const row = await trx
            .insertInto("crypto_buy_rates")
            .values({
                symbol,
                currency: CRYPTO_PURCHASES.CURRENCY,
                rate: rawRate,
                markupPercent: markup,
                effectiveFrom: now,
                expiresAt: new Date(now.getTime() + hours * 3600_000),
                setBy: userInfo().username.slice(0, 64),
                note: typeof flags.note === "string" ? flags.note.slice(0, 255) : null,
            })
            .returning(["id", "expiresAt"])
            .executeTakeFirstOrThrow();
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.CRYPTO_BUY_RATE_SET,
            actorType: AUDIT_ACTOR_TYPE.ADMIN,
            entityType: AUDIT_ENTITY_TYPE.CRYPTO_BUY_RATE,
            entityId: row.id,
            metadata: { symbol, rate: rawRate, markupPercent: markup, hours, previous: previous?.rate ?? null },
        });
        console.log(`${symbol}: ₦${rawRate} + ${markup}% markup, until ${row.expiresAt.toISOString()}`);
    });
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
