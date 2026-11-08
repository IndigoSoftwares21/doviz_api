import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateEmailVerificationAttempts {
    trx: Kysely<Database>;
    id: string;
    attempts: number;
    revokedAt: Date | null;
}

const updateEmailVerificationAttempts = async ({
    trx,
    id,
    attempts,
    revokedAt,
}: IUpdateEmailVerificationAttempts) => {
    const emailVerificationRow = await trx
        .updateTable("email_verifications")
        .set({ attempts, revokedAt })
        .where("id", "=", id)
        .returning(["id", "attempts"])
        .executeTakeFirstOrThrow();

    return emailVerificationRow;
};

export default updateEmailVerificationAttempts;
