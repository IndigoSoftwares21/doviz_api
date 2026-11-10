import { db } from "@/database";
import { PROVIDER_SERVICE } from "@/constants/withdrawals";

const selectActivePayoutProviderName = async () => {
    const settingRow = await db
        .selectFrom("provider_settings")
        .select(["activeProvider"])
        .where("service", "=", PROVIDER_SERVICE.PAYOUTS)
        .executeTakeFirst();

    return settingRow;
};

export default selectActivePayoutProviderName;
