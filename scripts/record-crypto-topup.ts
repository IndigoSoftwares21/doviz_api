// scripts/record-crypto-topup.ts — npm run crypto:record-topup -- <provider> <SYMBOL> <quantity> <naira cost> [--note "…"]
// Records coin bought into our stock at a provider and what it cost (for average cost and margin).
import * as dotenv from "dotenv";
dotenv.config();

import { userInfo } from "os";
import { db, disconnect } from "../src/database";
import createAuditLog from "../src/actions/auditLog/createAuditLog";
import isNairaAmount from "../src/utils/money/isNairaAmount";
import parseFlags from "./crypto-buy/parseFlags";
import AUDIT_ACTIONS from "../src/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "../src/constants/auditTargets";

const USAGE = 'Usage: npm run crypto:record-topup -- <provider> <SYMBOL> <quantity> <naira cost> [--note "…"]';

const main = async () => {
    const { positional, flags } = parseFlags(process.argv.slice(2));
    const [provider, rawSymbol, quantity, nairaCost] = positional;
    if (!provider || !rawSymbol || !/^\d+(\.\d{1,18})?$/.test(quantity ?? "") || Number(quantity) <= 0 || !isNairaAmount({ value: nairaCost ?? "" })) throw new Error(USAGE);
    const symbol = rawSymbol.toUpperCase();

    await db.transaction().execute(async (trx) => {
        const row = await trx
            .insertInto("crypto_stock_movements")
            .values({ provider, symbol, kind: "topup", quantity, nairaCost, recordedBy: userInfo().username.slice(0, 64), note: typeof flags.note === "string" ? flags.note.slice(0, 255) : null })
            .returning(["id"])
            .executeTakeFirstOrThrow();
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.CRYPTO_STOCK_RECORDED,
            actorType: AUDIT_ACTOR_TYPE.ADMIN,
            entityType: AUDIT_ENTITY_TYPE.CRYPTO_STOCK_MOVEMENT,
            entityId: row.id,
            metadata: { provider, symbol, quantity, nairaCost },
        });
        console.log(`Recorded ${quantity} ${symbol} at ${provider} for ₦${nairaCost}`);
    });
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
