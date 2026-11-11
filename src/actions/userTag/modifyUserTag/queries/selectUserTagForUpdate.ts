import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Row lock: two changes by the same user can't interleave. */
const selectUserTagForUpdate = async ({ trx, userId }: { trx: Kysely<Database>; userId: string }) => {
    const userRow = await trx.selectFrom("users").select(["tag", "tagChangedAt"]).where("id", "=", userId).forUpdate().executeTakeFirstOrThrow();

    return userRow;
};

export default selectUserTagForUpdate;
