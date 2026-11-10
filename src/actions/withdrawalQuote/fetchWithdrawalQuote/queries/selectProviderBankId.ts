import { db } from "@/database";

/** This provider's id/code for one of our banks; undefined when it can't pay to it. */
const selectProviderBankId = async ({ payoutBankId, provider, environment }: { payoutBankId: string; provider: string; environment: string }) => {
    const bankRow = await db
        .selectFrom("provider_banks")
        .select(["providerBankId"])
        .where("payoutBankId", "=", payoutBankId)
        .where("provider", "=", provider)
        .where("environment", "=", environment)
        .executeTakeFirst();

    return bankRow;
};

export default selectProviderBankId;
