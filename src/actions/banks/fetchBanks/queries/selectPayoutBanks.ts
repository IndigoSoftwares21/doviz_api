import { db } from "@/database";

const selectPayoutBanks = async ({ provider, environment }: { provider: string; environment: string }) => {
    const bankRows = await db
        .selectFrom("payout_banks")
        .innerJoin("provider_banks", "provider_banks.payoutBankId", "payout_banks.id")
        .select(["payout_banks.id", "payout_banks.name", "payout_banks.code"])
        .where("payout_banks.isEnabled", "=", true)
        .where("provider_banks.provider", "=", provider)
        .where("provider_banks.environment", "=", environment)
        .orderBy("payout_banks.name")
        .execute();

    return bankRows;
};

export default selectPayoutBanks;
