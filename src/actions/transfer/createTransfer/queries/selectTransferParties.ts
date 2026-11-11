import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Both people as they are now (status, tag, name), read inside the send transaction. */
const selectTransferParties = async ({ trx, userIds }: { trx: Kysely<Database>; userIds: string[] }) => {
    const partyRows = await trx
        .selectFrom("users")
        .select(["id", "status", "tag", "firstName", "lastName"])
        .where("id", "in", userIds)
        .execute();

    return partyRows;
};

export default selectTransferParties;
