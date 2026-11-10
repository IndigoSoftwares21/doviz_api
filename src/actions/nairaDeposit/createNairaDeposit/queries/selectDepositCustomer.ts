import { db } from "@/database";

/** What the provider needs to know about the payer. */
const selectDepositCustomer = async ({ userId }: { userId: string }) => {
    const userRow = await db
        .selectFrom("users")
        .select(["email", "firstName", "lastName"])
        .where("id", "=", userId)
        .executeTakeFirstOrThrow();

    return userRow;
};

export default selectDepositCustomer;
