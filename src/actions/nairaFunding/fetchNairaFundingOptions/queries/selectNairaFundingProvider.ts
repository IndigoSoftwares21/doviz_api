import { db } from "@/database";
import { PROVIDER_SERVICE } from "@/constants/withdrawals";

const selectNairaFundingProvider = async () => {
    const settingRow = await db.selectFrom("provider_settings").select(["activeProvider"]).where("service", "=", PROVIDER_SERVICE.NAIRA_FUNDING).executeTakeFirst();
    return settingRow ?? null;
};

export default selectNairaFundingProvider;
