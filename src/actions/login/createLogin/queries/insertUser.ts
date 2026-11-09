import { Kysely, sql } from "kysely";
import { Database } from "@/database/types";
import USER from "@/constants/user";

interface IInsertUser {
    trx: Kysely<Database>;
    phoneNumber: string;
    loggedInAt: Date;
}

// First successful verification registers the user; later ones just bump
// lastLoginAt. `xmax = 0` is true only when the row was freshly inserted.
const insertUser = async ({ trx, phoneNumber, loggedInAt }: IInsertUser) => {
    const userRow = await trx
        .insertInto("users")
        .values({
            phoneNumber,
            phoneVerifiedAt: loggedInAt,
            lastLoginAt: loggedInAt,
            status: USER.STATUS_ACTIVE,
        })
        .onConflict((oc) =>
            oc.column("phoneNumber").doUpdateSet({
                lastLoginAt: loggedInAt,
                updatedAt: loggedInAt,
            }),
        )
        .returning(["id", "phoneNumber", sql<boolean>`xmax = 0`.as("isNewUser")])
        .executeTakeFirstOrThrow();

    return userRow;
};

export default insertUser;
