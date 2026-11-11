import { db } from "@/database";
import USER from "@/constants/user";

/**
 * A user who can be paid by this exact tag: active, with a name, and not the
 * viewer. Anything else is "not found" — the caller can't tell which.
 */
const selectRecipientByTag = async ({ tag, viewerId }: { tag: string; viewerId: string }) => {
    const recipientRow = await db
        .selectFrom("users")
        .select(["id", "tag", "firstName", "lastName"])
        .where("tag", "=", tag)
        .where("id", "<>", viewerId)
        .where("status", "=", USER.STATUS_ACTIVE)
        .where("firstName", "is not", null)
        .where("lastName", "is not", null)
        .executeTakeFirst();

    return recipientRow;
};

export default selectRecipientByTag;
