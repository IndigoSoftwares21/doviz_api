import { db } from "@/database";

const selectUserByEmail = async ({ email }: { email: string }) => {
    const userRow = await db
        .selectFrom("users")
        .select(["id"])
        .where("email", "=", email)
        .executeTakeFirst();

    return userRow;
};

export default selectUserByEmail;
