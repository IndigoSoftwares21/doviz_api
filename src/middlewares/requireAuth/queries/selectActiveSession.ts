import { db } from "@/database";

// A session is only live while its device is still trusted.
const selectActiveSession = async ({
    sessionId,
    userId,
    now,
}: {
    sessionId: string;
    userId: string;
    now: Date;
}) => {
    const sessionRow = await db
        .selectFrom("auth_sessions")
        .innerJoin("user_devices", "user_devices.id", "auth_sessions.userDeviceId")
        .innerJoin("users", "users.id", "auth_sessions.userId")
        .select(["auth_sessions.id", "user_devices.deviceId", "users.status as accountStatus"])
        .where("auth_sessions.id", "=", sessionId)
        .where("auth_sessions.userId", "=", userId)
        .where("auth_sessions.revokedAt", "is", null)
        .where("auth_sessions.expiresAt", ">", now)
        .where("user_devices.revokedAt", "is", null)
        .executeTakeFirst();

    return sessionRow;
};

export default selectActiveSession;
