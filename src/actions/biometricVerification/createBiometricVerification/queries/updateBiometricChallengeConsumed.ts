import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateBiometricChallengeConsumed {
    trx: Kysely<Database>;
    id: string;
    consumedAt: Date;
}

const updateBiometricChallengeConsumed = async ({ trx, id, consumedAt }: IUpdateBiometricChallengeConsumed) => {
    const challengeRow = await trx
        .updateTable("biometric_challenges")
        .set({ consumedAt })
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return challengeRow;
};

export default updateBiometricChallengeConsumed;
