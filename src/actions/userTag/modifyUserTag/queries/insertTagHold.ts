import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** The tag a user gave up, held for them until `heldUntil`. */
const insertTagHold = async ({ trx, userId, tag, releasedAt, heldUntil }: { trx: Kysely<Database>; userId: string; tag: string; releasedAt: Date; heldUntil: Date }) => {
    await trx.insertInto("user_tag_history").values({ userId, tag, releasedAt, heldUntil }).execute();
};

export default insertTagHold;
