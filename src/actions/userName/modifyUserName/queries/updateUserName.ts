import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateUserName {
    trx: Kysely<Database>;
    userId: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    nameUpdatedAt: Date;
}

const updateUserName = async ({ trx, userId, firstName, middleName, lastName, nameUpdatedAt }: IUpdateUserName) => {
    const userRow = await trx
        .updateTable("users")
        .set({ firstName, middleName, lastName, nameUpdatedAt, updatedAt: nameUpdatedAt })
        .where("id", "=", userId)
        .returning(["firstName", "middleName", "lastName", "nameUpdatedAt"])
        .executeTakeFirstOrThrow();

    return userRow;
};

export default updateUserName;
