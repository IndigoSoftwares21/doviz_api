import { db } from "@/database";

/** An enabled bank and the given provider's id for it. */
const selectProviderBank = async ({
    bankId,
    provider,
    environment,
}: {
    bankId: string;
    provider: string;
    environment: string;
}) => {
    const bankRow = await db
        .selectFrom("payout_banks")
        .innerJoin("provider_banks", "provider_banks.payoutBankId", "payout_banks.id")
        .select(["payout_banks.id", "payout_banks.name", "payout_banks.code", "provider_banks.providerBankId"])
        .where("payout_banks.id", "=", bankId)
        .where("payout_banks.isEnabled", "=", true)
        .where("provider_banks.provider", "=", provider)
        .where("provider_banks.environment", "=", environment)
        .executeTakeFirst();

    return bankRow;
};

export default selectProviderBank;
