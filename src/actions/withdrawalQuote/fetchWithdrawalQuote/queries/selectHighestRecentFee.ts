import { db } from "@/database";

/** The highest real fee this provider charged us on a completed withdrawal since `since`. */
const selectHighestRecentFee = async ({ provider, environment, since }: { provider: string; environment: string; since: Date }) => {
    const feeRow = await db
        .selectFrom("bank_withdrawals")
        .select((eb) => eb.fn.max("fee").as("highestFee"))
        .where("provider", "=", provider)
        .where("environment", "=", environment)
        .where("status", "=", "completed")
        .where("finalizedAt", ">=", since)
        .executeTakeFirst();

    return feeRow;
};

export default selectHighestRecentFee;
