import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertSession {
    trx: Kysely<Database>;
    userId: string;
    userDeviceId: string;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: Date;
}

const insertSession = async ({ trx, userId, userDeviceId, ipAddress, userAgent, expiresAt }: IInsertSession) => {
    const sessionRow = await trx
        .insertInto("auth_sessions")
        .values({
            userId,
            userDeviceId,
            ipAddress,
            userAgent,
            expiresAt,
            revokedAt: null,
            revokedReason: null,
            lastUsedAt: null,
        })
        .returning(["id", "expiresAt"])
        .executeTakeFirstOrThrow();

    return sessionRow;
};

export default insertSession;
