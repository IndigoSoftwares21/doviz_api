import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertEmailVerification {
    trx: Kysely<Database>;
    userId: string;
    email: string;
    codeHash: string;
    maxAttempts: number;
    expiresAt: Date;
    requestIp: string | null;
    userAgent: string | null;
}

const insertEmailVerification = async ({
    trx,
    userId,
    email,
    codeHash,
    maxAttempts,
    expiresAt,
    requestIp,
    userAgent,
}: IInsertEmailVerification) => {
    const emailVerificationRow = await trx
        .insertInto("email_verifications")
        .values({
            userId,
            email,
            codeHash,
            attempts: 0,
            maxAttempts,
            expiresAt,
            requestIp,
            userAgent,
            consumedAt: null,
            revokedAt: null,
        })
        .returning(["id", "email", "expiresAt"])
        .executeTakeFirstOrThrow();

    return emailVerificationRow;
};

export default insertEmailVerification;
