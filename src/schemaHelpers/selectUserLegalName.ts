import { db } from "@/database";

/** Legal name plus whether a transfer PIN is set (onboarding complete). */
const selectUserLegalName = async ({ userId }: { userId: string }) => {
    const userRow = await db
        .selectFrom("users")
        .select((eb) => [
            "users.firstName",
            "users.lastName",
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

export default selectUserLegalName;
