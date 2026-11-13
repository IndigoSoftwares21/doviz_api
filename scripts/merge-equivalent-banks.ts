// scripts/merge-equivalent-banks.ts — npm run banks:merge [-- --apply]
// Banks that appear twice under different code systems (CBN "033" vs NIP
// "000004" — see constants/bankCodeEquivalents) become ONE bank: the row
// users' saved accounts point to keeps every provider's mapping; the other
// rows are switched off. Saved accounts never change (their bank is fixed by
// design). Dry run unless --apply. Re-runnable.
import * as dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env" });

import { db, disconnect } from "../src/database";
import BANK_CODE_EQUIVALENTS from "../src/constants/bankCodeEquivalents";

const main = async () => {
    const apply = process.argv.includes("--apply");
    for (const codes of BANK_CODE_EQUIVALENTS) {
        const rows = await db
            .selectFrom("payout_banks")
            .leftJoin("user_bank_accounts", "user_bank_accounts.payoutBankId", "payout_banks.id")
            .select((eb) => ["payout_banks.id", "payout_banks.name", "payout_banks.code", "payout_banks.createdAt", eb.fn.count<string>("user_bank_accounts.id").as("saved")])
            .where("payout_banks.code", "in", [...codes])
            .groupBy(["payout_banks.id", "payout_banks.name", "payout_banks.code", "payout_banks.createdAt"])
            .execute();
        if (rows.length < 2) continue;
        const withAccounts = rows.filter((row) => Number(row.saved) > 0);
        if (withAccounts.length > 1) {
            console.log(`! ${codes.join("/")}: saved accounts on ${withAccounts.length} rows (${withAccounts.map((r) => r.name).join(", ")}) — left alone, needs a person`);
            continue;
        }
        const keep = withAccounts[0] ?? [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
        const others = rows.filter((row) => row.id !== keep.id);
        console.log(`${apply ? "✓" : "•"} ${keep.name} (${keep.code}) keeps all mappings; off: ${others.map((r) => `${r.name} (${r.code})`).join(", ")}`);
        if (!apply) continue;

        await db.transaction().execute(async (trx) => {
            for (const other of others) {
                const mappings = await trx.selectFrom("provider_banks").selectAll().where("payoutBankId", "=", other.id).execute();
                for (const mapping of mappings) {
                    const existing = await trx.selectFrom("provider_banks").select(["id"]).where("payoutBankId", "=", keep.id).where("provider", "=", mapping.provider).where("environment", "=", mapping.environment).executeTakeFirst();
                    if (existing) await trx.deleteFrom("provider_banks").where("id", "=", mapping.id).execute();
                    else await trx.updateTable("provider_banks").set({ payoutBankId: keep.id }).where("id", "=", mapping.id).execute();
                }
                await trx.updateTable("payout_banks").set({ isEnabled: false, updatedAt: new Date() }).where("id", "=", other.id).execute();
            }
        });
    }
    if (!apply) console.log("\nDry run — nothing changed. Run with -- --apply to merge.");
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
