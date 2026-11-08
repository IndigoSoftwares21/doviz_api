import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateBiometricKeyLastUsed {
    trx: Kysely<Database>;
    id: string;
    lastUsedAt: Date;
}

const updateBiometricKeyLastUsed = async ({ trx, id, lastUsedAt }: IUpdateBiometricKeyLastUsed) => {
    const biometricKeyRow = await trx
        .updateTable("biometric_keys")
        .set({ lastUsedAt })
        .where("id", "=", id)
        .returning(["id", "lastUsedAt"])
        .executeTakeFirstOrThrow();

    return biometricKeyRow;
};

export default updateBiometricKeyLastUsed;
