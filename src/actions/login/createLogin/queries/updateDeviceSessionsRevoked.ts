import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateDeviceSessionsRevoked {
    trx: Kysely<Database>;
    userDeviceId: string;
    revokedAt: Date;
    revokedReason: string;
}

const updateDeviceSessionsRevoked = async ({
    trx,
    userDeviceId,
    revokedAt,
    revokedReason,
}: IUpdateDeviceSessionsRevoked) => {
    const revokedRows = await trx
        .updateTable("auth_sessions")
        .set({ revokedAt, revokedReason })
        .where("userDeviceId", "=", userDeviceId)
        .where("revokedAt", "is", null)
        .returning(["id"])
        .execute();

    return revokedRows;
};

export default updateDeviceSessionsRevoked;
