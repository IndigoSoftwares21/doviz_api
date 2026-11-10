// scripts/review-bill-billers.ts — npm run bills:review [-- <command>] [--provider=<name>]
//
//   (no command)                 list every provider biller with its suggested link
//   confirm <id>                 accept the suggested link for one provider biller
//   confirm all-suggested        accept every suggestion that has a biller
//   link <id> <biller-slug>      link to a different biller of ours (and confirm)
//   ignore <id>                  never list this provider biller (tax, courier, ...)
//   ignore all-unmatched         ignore every suggestion with no biller
//
// <id> is the first 8 characters shown in the list. Only CONFIRMED links reach the app.
import * as dotenv from "dotenv";
dotenv.config();

import { sql } from "kysely";
import { db, disconnect } from "../src/database";
import billProviderRegistry from "../src/services/bills/billProviderRegistry";
import registerBillProviders from "../src/services/bills/providers";
import { BILLER_LINK_STATUS } from "../src/constants/bills";

const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--provider="));
const providerArg = process.argv.find((arg) => arg.startsWith("--provider="))?.split("=")[1];

const main = async () => {
    registerBillProviders();
    const provider = providerArg ? billProviderRegistry.get({ name: providerArg }) : billProviderRegistry.active();
    const scope = { provider: provider.name, environment: provider.environment };
    const [command, target, slug] = args;
    const now = new Date();

    const refsQuery = () =>
        db
            .selectFrom("biller_provider_refs")
            .where("provider", "=", scope.provider)
            .where("environment", "=", scope.environment);

    const byShortId = async (id: string | undefined) => {
        if (!id || !/^[0-9a-f]{4,36}$/i.test(id)) throw new Error("Give the id shown in the list (first 8 characters)");
        const rows = await refsQuery().select(["id"]).where(sql`id::text`, "like", `${id.toLowerCase()}%`).execute();
        if (rows.length !== 1) throw new Error(rows.length ? `"${id}" matches ${rows.length} rows; use more characters` : `No provider biller "${id}"`);
        return rows[0].id;
    };

    const confirm = async (ids: string[]) => {
        if (!ids.length) return 0;
        await db
            .updateTable("biller_provider_refs")
            .set({ status: BILLER_LINK_STATUS.CONFIRMED, reviewedAt: now, updatedAt: now })
            .where("id", "in", ids)
            .where("billerId", "is not", null)
            .execute();
        // A biller with no logo yet borrows the provider's (ours always wins once set).
        await sql`
            UPDATE billers b SET logo_url = r.provider_logo_url, updated_at = now()
            FROM biller_provider_refs r
            WHERE r.biller_id = b.id AND r.id = ANY(${ids}::uuid[])
              AND b.logo_url IS NULL AND r.provider_logo_url IS NOT NULL`.execute(db);
        return ids.length;
    };

    const ignore = async (ids: string[]) => {
        if (!ids.length) return 0;
        await db
            .updateTable("biller_provider_refs")
            .set({ status: BILLER_LINK_STATUS.IGNORED, reviewedAt: now, updatedAt: now })
            .where("id", "in", ids)
            .execute();
        return ids.length;
    };

    if (command === "confirm" && target === "all-suggested") {
        const rows = await refsQuery().select(["id"]).where("status", "=", BILLER_LINK_STATUS.SUGGESTED).where("billerId", "is not", null).execute();
        console.log(`Confirmed ${await confirm(rows.map((row) => row.id))} links`);
    } else if (command === "confirm") {
        const id = await byShortId(target);
        const row = await refsQuery().select(["billerId"]).where("id", "=", id).executeTakeFirstOrThrow();
        if (!row.billerId) throw new Error("No suggested biller to confirm; use: link <id> <biller-slug>");
        await confirm([id]);
        console.log("Confirmed");
    } else if (command === "link") {
        const id = await byShortId(target);
        const biller = await db.selectFrom("billers").select(["id"]).where("slug", "=", slug ?? "").executeTakeFirst();
        if (!biller) throw new Error(`No biller with slug "${slug}"`);
        await db.updateTable("biller_provider_refs").set({ billerId: biller.id, matchReason: "Linked by hand", updatedAt: now }).where("id", "=", id).execute();
        await confirm([id]);
        console.log(`Linked to ${slug} — run npm run bills:sync to re-clean its product names`);
    } else if (command === "ignore" && target === "all-unmatched") {
        const rows = await refsQuery().select(["id"]).where("status", "=", BILLER_LINK_STATUS.SUGGESTED).where("billerId", "is", null).execute();
        console.log(`Ignored ${await ignore(rows.map((row) => row.id))} provider billers`);
    } else if (command === "ignore") {
        await ignore([await byShortId(target)]);
        console.log("Ignored");
    } else if (command) {
        throw new Error(`Unknown command "${command}"`);
    }

    const rows = await db
        .selectFrom("biller_provider_refs as r")
        .leftJoin("billers as b", "b.id", "r.billerId")
        .select((eb) => [
            "r.id",
            "r.status",
            "r.providerBillerRef",
            "r.providerName",
            "r.matchReason",
            "r.isAvailable",
            "b.slug",
            eb.selectFrom("bill_products as p").whereRef("p.billerProviderRefId", "=", "r.id").where("p.isAvailable", "=", true).select((p) => p.fn.countAll<string>().as("n")).as("products"),
        ])
        .where("r.provider", "=", scope.provider)
        .where("r.environment", "=", scope.environment)
        .orderBy("r.status", "desc")
        .orderBy("b.slug")
        .orderBy("r.providerName")
        .execute();

    console.log(`\n${scope.provider} (${scope.environment}) — ${rows.length} provider billers`);
    for (const row of rows) {
        const link = row.slug ? `→ ${row.slug}` : "→ (no match)";
        const gone = row.isAvailable ? "" : " [no longer offered]";
        console.log(`${row.id.slice(0, 8)}  ${row.status.padEnd(9)} ${row.providerBillerRef.padEnd(10)} ${row.providerName.padEnd(40)} ${link.padEnd(26)} ${String(row.products ?? 0).padStart(3)} products${gone}`);
        if (row.status === BILLER_LINK_STATUS.SUGGESTED && row.matchReason) console.log(`          ${row.matchReason}`);
    }
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
