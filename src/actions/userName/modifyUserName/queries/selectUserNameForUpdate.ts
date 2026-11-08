import { Kysely } from "kysely";
import { Database } from "@/database/types";

const selectUserNameForUpdate = async ({ trx, userId }: { trx: Kysely<Database>; userId: string }) => {
    const userRow = await trx
        .selectFrom("users")
        .select(["firstName", "middleName", "lastName"])
        .where("id", "=", userId)
        .forUpdate()
        .executeTakeFirstOrThrow();

    return userRow;
};

export default selectUserNameForUpdate;
