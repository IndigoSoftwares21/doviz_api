import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertRefreshToken {
    trx: Kysely<Database>;
    sessionId: string;
    tokenHash: string;
}

const insertRefreshToken = async ({ trx, sessionId, tokenHash }: IInsertRefreshToken) => {
    const refreshTokenRow = await trx
        .insertInto("auth_refresh_tokens")
        .values({ sessionId, tokenHash, rotatedAt: null })
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return refreshTokenRow;
};

export default insertRefreshToken;
