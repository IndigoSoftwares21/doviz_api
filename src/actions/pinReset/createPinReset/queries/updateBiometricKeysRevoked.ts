import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateBiometricKeysRevoked {
    trx: Kysely<Database>;
    userId: string;
    revokedAt: Date;
}

const updateBiometricKeysRevoked = async ({ trx, userId, revokedAt }: IUpdateBiometricKeysRevoked) => {
    const revokedRows = await trx
        .updateTable("biometric_keys")
        .set({ revokedAt })
        .where("userId", "=", userId)
        .where("revokedAt", "is", null)
        .returning(["id", "deviceId"])
        .execute();

    return revokedRows;
};

export default updateBiometricKeysRevoked;
