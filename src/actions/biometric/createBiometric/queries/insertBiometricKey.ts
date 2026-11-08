import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertBiometricKey {
    trx: Kysely<Database>;
    userId: string;
    deviceId: string;
    deviceName: string | null;
    publicKey: string;
}

const insertBiometricKey = async ({ trx, userId, deviceId, deviceName, publicKey }: IInsertBiometricKey) => {
    const biometricKeyRow = await trx
        .insertInto("biometric_keys")
        .values({ userId, deviceId, deviceName, publicKey, lastUsedAt: null, revokedAt: null })
        .returning(["id", "deviceId", "deviceName", "createdAt"])
        .executeTakeFirstOrThrow();

    return biometricKeyRow;
};

export default insertBiometricKey;
