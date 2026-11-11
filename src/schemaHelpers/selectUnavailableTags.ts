import { sql } from "kysely";
import { db } from "@/database";

/**
 * Which of `tags` this user can't take: held by another user now, or
 * released by another user and still in its 30-day hold. The user's own
 * current or held tags never count against them. Returns tags only — never
 * who has them.
 */
const selectUnavailableTags = async ({ tags, userId }: { tags: string[]; userId: string }) => {
    if (!tags.length) return new Set<string>();

    const held = await db
        .selectFrom("users")
        .select(["users.tag"])
        .where("users.tag", "in", tags)
        .where("users.id", "<>", userId)
        .unionAll(
            db
                .selectFrom("user_tag_history")
                .select(["user_tag_history.tag"])
                .where("user_tag_history.tag", "in", tags)
                .where("user_tag_history.userId", "<>", userId)
                .where("user_tag_history.heldUntil", ">", sql<Date>`now()`),
        )
        .execute();

    return new Set(held.map((row) => row.tag).filter((tag): tag is string => tag !== null));
};

export default selectUnavailableTags;
