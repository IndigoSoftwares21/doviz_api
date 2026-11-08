import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface ISelectLiveEmailVerification {
    trx: Kysely<Database>;
    userId: string;
    now: Date;
}

// FOR UPDATE serialises concurrent confirmations so every guess is counted
// and a code is consumed at most once.
const selectLiveEmailVerification = async ({
    trx,
    userId,
    now,
}: ISelectLiveEmailVerification) => {
    const emailVerificationRow = await trx
        .selectFrom("email_verifications")
        .select(["id", "email", "codeHash", "attempts", "maxAttempts"])
        .where("userId", "=", userId)
        .where("consumedAt", "is", null)
        .where("revokedAt", "is", null)
        .where("expiresAt", ">", now)
        .whereRef("attempts", "<", "maxAttempts")
        .orderBy("createdAt", "desc")
        .limit(1)
        .forUpdate()
        .executeTakeFirst();

    return emailVerificationRow;
};

export default selectLiveEmailVerification;
