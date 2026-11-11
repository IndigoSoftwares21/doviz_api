import { Kysely } from "kysely";
import { Database } from "@/database/types";

const updateUserTag = async ({ trx, userId, tag, changedAt }: { trx: Kysely<Database>; userId: string; tag: string; changedAt: Date }) => {
    const userRow = await trx
        .updateTable("users")
        .set({ tag, tagChangedAt: changedAt, updatedAt: changedAt })
        .where("id", "=", userId)
        .returning(["tag", "tagChangedAt"])
        .executeTakeFirstOrThrow();

    return userRow;
};

export default updateUserTag;
