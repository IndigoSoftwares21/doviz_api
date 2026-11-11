import { sql } from "kysely";
import { db } from "@/database";
import USER from "@/constants/user";
import TRANSFERS from "@/constants/transfers";

/**
 * The last people this user sent to (distinct, newest first) who can still be
 * paid. Their CURRENT tag, so a repeat send goes to the right person.
 */
const selectRecentRecipients = async ({ userId }: { userId: string }) => {
    const recipientRows = await db
        .selectFrom("internal_transfers")
        .innerJoin("users", "users.id", "internal_transfers.recipientId")
        .select(["users.id", "users.tag", "users.firstName", "users.lastName"])
        .where("internal_transfers.senderId", "=", userId)
        .where("users.status", "=", USER.STATUS_ACTIVE)
        .where("users.tag", "is not", null)
        .where("users.firstName", "is not", null)
        .where("users.lastName", "is not", null)
        .groupBy(["users.id", "users.tag", "users.firstName", "users.lastName"])
        .orderBy(sql`max(internal_transfers.created_at)`, "desc")
        .limit(TRANSFERS.RECENT_RECIPIENTS)
        .execute();

    return recipientRows;
};

export default selectRecentRecipients;
