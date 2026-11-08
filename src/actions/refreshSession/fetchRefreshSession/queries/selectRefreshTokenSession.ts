import { Kysely } from "kysely";
import { Database } from "@/database/types";

// Locks the token, session and device rows so two unlocks with the same
// token can't both succeed.
const selectRefreshTokenSession = async ({ trx, tokenHash }: { trx: Kysely<Database>; tokenHash: string }) => {
    const refreshTokenRow = await trx
        .selectFrom("auth_refresh_tokens")
        .innerJoin("auth_sessions", "auth_sessions.id", "auth_refresh_tokens.sessionId")
        .innerJoin("user_devices", "user_devices.id", "auth_sessions.userDeviceId")
        .innerJoin("users", "users.id", "auth_sessions.userId")
        .select([
            "auth_refresh_tokens.id as refreshTokenId",
            "auth_refresh_tokens.rotatedAt",
            "auth_sessions.id as sessionId",
            "auth_sessions.userId",
            "auth_sessions.revokedAt as sessionRevokedAt",
            "auth_sessions.expiresAt",
            "user_devices.id as userDeviceId",
            "user_devices.deviceId",
            "user_devices.revokedAt as deviceRevokedAt",
            "users.status as accountStatus",
        ])
        .where("auth_refresh_tokens.tokenHash", "=", tokenHash)
        .forUpdate()
        .executeTakeFirst();

    return refreshTokenRow;
};

export default selectRefreshTokenSession;
