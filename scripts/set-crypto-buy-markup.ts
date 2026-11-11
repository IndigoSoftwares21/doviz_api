// scripts/set-crypto-buy-markup.ts — npm run crypto:set-buy-markup -- ETH 2 [--note "…"]
// Our markup on a coin priced from the market (USDT rate × live price). Audited; the next quote uses it.
import * as dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env" }); // .env.production under the :prod commands

import { userInfo } from "os";
import Decimal from "decimal.js";
import { db, disconnect } from "../src/database";
import createAuditLog from "../src/actions/auditLog/createAuditLog";
import parseFlags from "./crypto-buy/parseFlags";
import AUDIT_ACTIONS from "../src/constants/auditActions";
import CRYPTO_PURCHASES from "../src/constants/cryptoPurchases";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "../src/constants/auditTargets";

const USAGE = 'Usage: npm run crypto:set-buy-markup -- <SYMBOL> <percent, e.g. 1.5> [--note "…"]';

const main = async () => {
    const { positional, flags } = parseFlags(process.argv.slice(2));
    const [rawSymbol, rawPercent] = positional;
    if (!rawSymbol || !rawPercent || !/^\d+(\.\d{1,3})?$/.test(rawPercent)) throw new Error(USAGE);
    const symbol = rawSymbol.toUpperCase();
    if (!/^[A-Z0-9]{2,16}$/.test(symbol)) throw new Error(USAGE);
    if (symbol === CRYPTO_PURCHASES.BASE_SYMBOL) throw new Error(`${symbol} is priced by its own rate: use crypto:set-rate -- ${symbol} <rate> --markup <percent>`);
    if (new Decimal(rawPercent).greaterThan(CRYPTO_PURCHASES.MAX_BUY_MARKUP_PERCENT)) throw new Error(`The markup can't be over ${CRYPTO_PURCHASES.MAX_BUY_MARKUP_PERCENT}%`);

    const note = typeof flags.note === "string" ? flags.note.slice(0, 255) : null;
    const updatedBy = userInfo().username.slice(0, 64);
    await db.transaction().execute(async (trx) => {
        const previous = await trx.selectFrom("crypto_buy_markups").select(["markupPercent"]).where("symbol", "=", symbol).executeTakeFirst();
        const row = await trx
            .insertInto("crypto_buy_markups")
            .values({ symbol, markupPercent: rawPercent, note, updatedBy })
            .onConflict((oc) => oc.column("symbol").doUpdateSet({ markupPercent: rawPercent, note, updatedBy, updatedAt: new Date() }))
            .returning(["id"])
            .executeTakeFirstOrThrow();
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.CRYPTO_BUY_MARKUP_SET,
            actorType: AUDIT_ACTOR_TYPE.ADMIN,
            entityType: AUDIT_ENTITY_TYPE.CRYPTO_BUY_MARKUP,
            entityId: row.id,
            metadata: { symbol, markupPercent: rawPercent, previous: previous?.markupPercent ?? null, note },
        });
        console.log(`${symbol}: ${previous ? `${new Decimal(previous.markupPercent).toFixed()}% → ` : ""}${rawPercent}% markup on the market price`);
    });
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
