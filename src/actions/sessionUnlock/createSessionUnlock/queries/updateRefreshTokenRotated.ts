import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateRefreshTokenRotated {
    trx: Kysely<Database>;
    id: string;
    rotatedAt: Date;
}

// Only rotates a token that hasn't been used yet — the second of two
// concurrent unlocks gets undefined.
const updateRefreshTokenRotated = async ({ trx, id, rotatedAt }: IUpdateRefreshTokenRotated) => {
    const refreshTokenRow = await trx
        .updateTable("auth_refresh_tokens")
        .set({ rotatedAt })
        .where("id", "=", id)
        .where("rotatedAt", "is", null)
        .returning(["id"])
        .executeTakeFirst();

    return refreshTokenRow;
};

export default updateRefreshTokenRotated;
