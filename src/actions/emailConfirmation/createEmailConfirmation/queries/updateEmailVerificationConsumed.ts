import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateEmailVerificationConsumed {
    trx: Kysely<Database>;
    id: string;
    consumedAt: Date;
}

const updateEmailVerificationConsumed = async ({
    trx,
    id,
    consumedAt,
}: IUpdateEmailVerificationConsumed) => {
    const emailVerificationRow = await trx
        .updateTable("email_verifications")
        .set({ consumedAt })
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return emailVerificationRow;
};

export default updateEmailVerificationConsumed;
