import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateDeviceBiometricKeysRevoked {
    trx: Kysely<Database>;
    userId: string;
    deviceId: string;
    revokedAt: Date;
}

const updateDeviceBiometricKeysRevoked = async ({
    trx,
    userId,
    deviceId,
    revokedAt,
}: IUpdateDeviceBiometricKeysRevoked) => {
    const revokedRows = await trx
        .updateTable("biometric_keys")
        .set({ revokedAt })
        .where("userId", "=", userId)
        .where("deviceId", "=", deviceId)
        .where("revokedAt", "is", null)
        .returning(["id"])
        .execute();

    return revokedRows;
};

export default updateDeviceBiometricKeysRevoked;
