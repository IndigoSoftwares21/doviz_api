import { db } from "@/database";

const selectBiometricDevices = async ({ userId }: { userId: string }) => {
    const biometricDeviceRows = await db
        .selectFrom("biometric_keys")
        .select(["deviceId", "deviceName", "createdAt", "lastUsedAt"])
        .where("userId", "=", userId)
        .where("revokedAt", "is", null)
        .orderBy("createdAt", "desc")
        .execute();

    return biometricDeviceRows;
};

export default selectBiometricDevices;
