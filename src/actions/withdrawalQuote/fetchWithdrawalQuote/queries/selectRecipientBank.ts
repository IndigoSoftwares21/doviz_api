import { db } from "@/database";

/** An enabled bank someone can be paid at (for a transfer to another person's account). */
const selectRecipientBank = async ({ payoutBankId }: { payoutBankId: string }) => {
    const bankRow = await db.selectFrom("payout_banks").select(["id", "name"]).where("id", "=", payoutBankId).where("isEnabled", "=", true).executeTakeFirst();
    return bankRow ?? null;
};

export default selectRecipientBank;
