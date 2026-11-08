import { db } from "@/database";

const selectUserDevices = async ({ userId, now }: { userId: string; now: Date }) => {
    const userDeviceRows = await db
        .selectFrom("user_devices")
        .select((eb) => [
            "user_devices.deviceId",
            "user_devices.deviceName",
            "user_devices.platform",
            "user_devices.lastSeenAt",
            "user_devices.trustedAt",
            "user_devices.createdAt",
            eb
                .exists(
                    eb
                        .selectFrom("auth_sessions")
                        .select("auth_sessions.id")
                        .whereRef("auth_sessions.userDeviceId", "=", "user_devices.id")
                        .where("auth_sessions.revokedAt", "is", null)
                        .where("auth_sessions.expiresAt", ">", now),
                )
                .as("hasActiveSession"),
            eb
                .exists(
                    eb
                        .selectFrom("biometric_keys")
                        .select("biometric_keys.id")
                        .whereRef("biometric_keys.userId", "=", "user_devices.userId")
                        .whereRef("biometric_keys.deviceId", "=", "user_devices.deviceId")
                        .where("biometric_keys.revokedAt", "is", null),
                )
                .as("biometricsEnabled"),
        ])
        .where("user_devices.userId", "=", userId)
        .where("user_devices.revokedAt", "is", null)
        .orderBy("user_devices.lastSeenAt", "desc")
        .execute();

    return userDeviceRows;
};

export default selectUserDevices;
