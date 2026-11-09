import { db } from "@/database";

const selectResolutionBank = async ({
    bankId,
    provider,
    environment,
}: {
    bankId: string;
    provider: string;
    environment: string;
}) => {
    const bankRow = await db
        .selectFrom("provider_banks")
        .select(["providerBankId"])
        .where("payoutBankId", "=", bankId)
        .where("provider", "=", provider)
        .where("environment", "=", environment)
        .executeTakeFirstOrThrow();

    return bankRow;
};

export default selectResolutionBank;
