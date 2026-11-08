import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface ISelectLiveBiometricChallenge {
    trx: Kysely<Database>;
    challengeId: string;
    userId: string;
    purpose: string;
    now: Date;
}

const selectLiveBiometricChallenge = async ({ trx, challengeId, userId, purpose, now }: ISelectLiveBiometricChallenge) => {
    const challengeRow = await trx
        .selectFrom("biometric_challenges")
        .select(["id", "challenge", "biometricKeyId"])
        .where("id", "=", challengeId)
        .where("userId", "=", userId)
        .where("purpose", "=", purpose)
        .where("consumedAt", "is", null)
        .where("expiresAt", ">", now)
        .forUpdate()
        .executeTakeFirst();

    return challengeRow;
};

export default selectLiveBiometricChallenge;
