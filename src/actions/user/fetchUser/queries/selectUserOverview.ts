import { db } from "@/database";

const selectUserOverview = async ({ userId, deviceId }: { userId: string; deviceId: string }) => {
    const userRow = await db
        .selectFrom("users")
        .select((eb) => [
            "users.id",
            "users.phoneNumber",
            "users.firstName",
            "users.middleName",
            "users.lastName",
            "users.tag",
            "users.email",
            "users.emailVerifiedAt",
            "users.status",
            "users.createdAt",
            eb
                .exists(
                    eb
                        .selectFrom("transaction_pins")
                        .select("transaction_pins.userId")
                        .whereRef("transaction_pins.userId", "=", "users.id"),
                )
                .as("hasPin"),
            eb
                .exists(
                    eb
                        .selectFrom("biometric_keys")
                        .select("biometric_keys.id")
                        .whereRef("biometric_keys.userId", "=", "users.id")
                        .where("biometric_keys.deviceId", "=", deviceId)
                        .where("biometric_keys.revokedAt", "is", null),
                )
                .as("biometricsEnabled"),
        ])
        .where("users.id", "=", userId)
        .executeTakeFirstOrThrow();

    return userRow;
};

export default selectUserOverview;
