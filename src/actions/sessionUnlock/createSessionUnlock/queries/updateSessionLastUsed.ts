import { Kysely } from "kysely";
import { Database } from "@/database/types";

const updateSessionLastUsed = async ({
    trx,
    sessionId,
    lastUsedAt,
}: {
    trx: Kysely<Database>;
    sessionId: string;
    lastUsedAt: Date;
}) => {
    const sessionRow = await trx
        .updateTable("auth_sessions")
        .set({ lastUsedAt })
        .where("id", "=", sessionId)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return sessionRow;
};

export default updateSessionLastUsed;
