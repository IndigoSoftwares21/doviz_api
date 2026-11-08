import { db } from "@/database";

const selectUserNameStatus = async ({ userId }: { userId: string }) => {
    const userRow = await db
        .selectFrom("users")
        .select((eb) => [
            "users.firstName",
            eb
                .exists(
                    eb
                        .selectFrom("transaction_pins")
                        .select("transaction_pins.userId")
                        .whereRef("transaction_pins.userId", "=", "users.id"),
                )
                .as("hasPin"),
        ])
        .where("users.id", "=", userId)
        .executeTakeFirst();

    return userRow;
};

export default selectUserNameStatus;
