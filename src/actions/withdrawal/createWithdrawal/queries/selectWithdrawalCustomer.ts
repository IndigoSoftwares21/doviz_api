import { db } from "@/database";

/** Who the payout is for, as the provider needs it (the email is only set once verified). */
const selectWithdrawalCustomer = async ({ userId }: { userId: string }) => {
    const userRow = await db
        .selectFrom("users")
        .select(["firstName", "lastName", "email"])
        .where("id", "=", userId)
        .executeTakeFirstOrThrow();

    return userRow;
};

export default selectWithdrawalCustomer;
