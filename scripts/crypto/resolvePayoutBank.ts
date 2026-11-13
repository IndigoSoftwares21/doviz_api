import { db } from "../../src/database";
import { ProviderBank } from "../../src/services/crypto/types";
import { equivalentBankCodes } from "../../src/constants/bankCodeEquivalents";

/**
 * Our bank row for a provider's bank. Identity is the CBN/NIP code when the
 * provider gives one (names differ between providers and even between a
 * provider's sandbox and production lists: "UBA" vs "United Bank for
 * Africa"), else the name slug. Codes for the same bank under another code
 * system (CBN "058" = NIP "000013", see bankCodeEquivalents) count as the same
 * bank — the enabled row wins (after `npm run banks:merge`, the one users'
 * saved accounts point to), else the oldest. A code
 * is never given to a second row.
 */
const resolvePayoutBank = async ({ bank }: { bank: ProviderBank }) => {
    const byCode = bank.code
        ? await db.selectFrom("payout_banks").select(["id"]).where("code", "in", [...equivalentBankCodes(bank.code)]).orderBy("isEnabled", "desc").orderBy("createdAt").executeTakeFirst()
        : undefined;
    if (byCode) return byCode.id;

    const bySlug = await db.selectFrom("payout_banks").select(["id", "code"]).where("slug", "=", bank.slug).executeTakeFirst();
    if (bySlug) {
        // Fill in a missing code (byCode above proved no other row has it); never overwrite one.
        if (!bySlug.code && bank.code) await db.updateTable("payout_banks").set({ code: bank.code, updatedAt: new Date() }).where("id", "=", bySlug.id).execute();
        return bySlug.id;
    }

    const inserted = await db
        .insertInto("payout_banks")
        .values({ name: bank.name, slug: bank.slug, code: bank.code, isEnabled: true })
        .returning(["id"])
        .executeTakeFirstOrThrow();
    return inserted.id;
};

export default resolvePayoutBank;
