import { db } from "@/database";

const selectUserPhone = async ({ userId }: { userId: string }) => {
    const userRow = await db
        .selectFrom("users")
        .select(["id", "phoneNumber"])
        .where("id", "=", userId)
        .executeTakeFirstOrThrow();

    return userRow;
};

export default selectUserPhone;
