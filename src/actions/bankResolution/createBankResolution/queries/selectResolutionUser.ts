import { db } from "@/database";

const selectResolutionUser = async ({ userId }: { userId: string }) => {
    const userRow = await db
        .selectFrom("users")
        .select(["firstName", "lastName"])
        .where("id", "=", userId)
        .executeTakeFirstOrThrow();

    return userRow;
};

export default selectResolutionUser;
