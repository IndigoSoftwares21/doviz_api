import { db } from "@/database";

interface IInsertBiometricChallenge {
    userId: string;
    biometricKeyId: string;
    purpose: string;
    challenge: string;
    expiresAt: Date;
}

const insertBiometricChallenge = async ({
    userId,
    biometricKeyId,
    purpose,
    challenge,
    expiresAt,
}: IInsertBiometricChallenge) => {
    const challengeRow = await db
        .insertInto("biometric_challenges")
        .values({ userId, biometricKeyId, purpose, challenge, expiresAt, consumedAt: null })
        .returning(["id", "challenge", "expiresAt"])
        .executeTakeFirstOrThrow();

    return challengeRow;
};

export default insertBiometricChallenge;
