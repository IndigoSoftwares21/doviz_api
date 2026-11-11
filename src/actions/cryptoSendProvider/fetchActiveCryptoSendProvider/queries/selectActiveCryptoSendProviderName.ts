import { db } from "@/database";
import { PROVIDER_SERVICE } from "@/constants/withdrawals";

const selectActiveCryptoSendProviderName = async () => {
    const settingRow = await db
        .selectFrom("provider_settings")
        .select(["activeProvider"])
        .where("service", "=", PROVIDER_SERVICE.CRYPTO_SENDS)
        .executeTakeFirst();

    return settingRow;
};

export default selectActiveCryptoSendProviderName;
