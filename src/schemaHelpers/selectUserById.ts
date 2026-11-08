import { db } from "@/database";

const selectUserById = async ({ userId }: { userId: string }) => {
    const userRow = await db
        .selectFrom("users")
        .select(["id", "phoneNumber"])
        .where("id", "=", userId)
        .executeTakeFirst();

    return userRow;
};

export default selectUserById;
