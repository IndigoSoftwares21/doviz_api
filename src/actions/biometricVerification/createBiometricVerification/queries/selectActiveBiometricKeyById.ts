import { Kysely } from "kysely";
import { Database } from "@/database/types";

const selectActiveBiometricKeyById = async ({ trx, id }: { trx: Kysely<Database>; id: string }) => {
    const biometricKeyRow = await trx
        .selectFrom("biometric_keys")
        .select(["id", "deviceId", "publicKey"])
        .where("id", "=", id)
        .where("revokedAt", "is", null)
        .executeTakeFirst();

    return biometricKeyRow;
};

export default selectActiveBiometricKeyById;
