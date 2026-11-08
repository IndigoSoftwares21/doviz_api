import { db } from "@/database";

const selectBiometricKeyForDevice = async ({ userId, deviceId }: { userId: string; deviceId: string }) => {
    const biometricKeyRow = await db
        .selectFrom("biometric_keys")
        .select(["id"])
        .where("userId", "=", userId)
        .where("deviceId", "=", deviceId)
        .where("revokedAt", "is", null)
        .executeTakeFirst();

    return biometricKeyRow;
};

export default selectBiometricKeyForDevice;
