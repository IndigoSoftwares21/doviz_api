import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateUserEmail {
    trx: Kysely<Database>;
    userId: string;
    email: string;
    emailVerifiedAt: Date;
}

const updateUserEmail = async ({ trx, userId, email, emailVerifiedAt }: IUpdateUserEmail) => {
    const userRow = await trx
        .updateTable("users")
        .set({ email, emailVerifiedAt, updatedAt: emailVerifiedAt })
        .where("id", "=", userId)
        .returning(["id", "email", "emailVerifiedAt"])
        .executeTakeFirstOrThrow();

    return userRow;
};

export default updateUserEmail;
