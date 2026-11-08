import { Kysely } from "kysely";
import { Database } from "@/database/types";

const selectUserPhoneForReset = async ({ trx, userId }: { trx: Kysely<Database>; userId: string }) => {
    const userRow = await trx
        .selectFrom("users")
        .select(["id", "phoneNumber"])
        .where("id", "=", userId)
        .executeTakeFirstOrThrow();

    return userRow;
};

export default selectUserPhoneForReset;
