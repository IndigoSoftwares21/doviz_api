import { db } from "@/database";

/** The configured default fee for this provider + environment (null when none is set). */
const selectPayoutFeeDefault = async ({ provider, environment, currency }: { provider: string; environment: string; currency: string }) => {
    const feeRow = await db
        .selectFrom("payout_fee_defaults")
        .select(["fixedFee", "vatPercent"])
        .where("provider", "=", provider)
        .where("environment", "=", environment)
        .where("currency", "=", currency)
        .executeTakeFirst();

    return feeRow;
};

export default selectPayoutFeeDefault;
