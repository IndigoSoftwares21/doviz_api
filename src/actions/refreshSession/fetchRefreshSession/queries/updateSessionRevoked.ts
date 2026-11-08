import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateSessionRevoked {
    trx: Kysely<Database>;
    sessionId: string;
    revokedAt: Date;
    revokedReason: string;
}

const updateSessionRevoked = async ({ trx, sessionId, revokedAt, revokedReason }: IUpdateSessionRevoked) => {
    const sessionRow = await trx
        .updateTable("auth_sessions")
        .set({ revokedAt, revokedReason })
        .where("id", "=", sessionId)
        .where("revokedAt", "is", null)
        .returning(["id"])
        .executeTakeFirst();

    return sessionRow;
};

export default updateSessionRevoked;
