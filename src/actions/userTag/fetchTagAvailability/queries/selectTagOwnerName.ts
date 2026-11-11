import { db } from "@/database";

/** The requesting user's own name and tag (for suggestions and change rules). */
const selectTagOwnerName = async ({ userId }: { userId: string }) => {
    const userRow = await db
        .selectFrom("users")
        .select(["firstName", "lastName", "tag", "tagChangedAt"])
        .where("id", "=", userId)
        .executeTakeFirst();

    return userRow;
};

export default selectTagOwnerName;
