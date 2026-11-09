import { db } from "@/database";
import { WALLET_STATUS } from "@/constants/cryptoStatus";

/** Providers that issued any live address (so they can still receive deposits). */
const selectDepositProviders = async () => {
    const providerRows = await db
        .selectFrom("crypto_wallets")
        .select(["provider"])
        .distinct()
        .where("status", "in", [WALLET_STATUS.ACTIVE, WALLET_STATUS.RETIRED])
        .execute();

    return providerRows;
};

export default selectDepositProviders;
