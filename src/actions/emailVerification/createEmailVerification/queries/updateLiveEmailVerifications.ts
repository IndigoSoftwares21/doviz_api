import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateLiveEmailVerifications {
    trx: Kysely<Database>;
    userId: string;
    revokedAt: Date;
}

// Only the newest code is ever valid; also keeps the one-live-code unique
// index satisfied.
const updateLiveEmailVerifications = async ({
    trx,
    userId,
    revokedAt,
}: IUpdateLiveEmailVerifications) => {
    const revokedRows = await trx
        .updateTable("email_verifications")
        .set({ revokedAt })
        .where("userId", "=", userId)
        .where("consumedAt", "is", null)
        .where("revokedAt", "is", null)
        .returning(["id"])
        .execute();

    return revokedRows;
};

export default updateLiveEmailVerifications;
