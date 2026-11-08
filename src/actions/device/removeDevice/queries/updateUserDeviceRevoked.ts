import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateUserDeviceRevoked {
    trx: Kysely<Database>;
    userId: string;
    deviceId: string;
    revokedAt: Date;
}

const updateUserDeviceRevoked = async ({ trx, userId, deviceId, revokedAt }: IUpdateUserDeviceRevoked) => {
    const userDeviceRow = await trx
        .updateTable("user_devices")
        .set({ revokedAt })
        .where("userId", "=", userId)
        .where("deviceId", "=", deviceId)
        .where("revokedAt", "is", null)
        .returning(["id"])
        .executeTakeFirst();

    return userDeviceRow;
};

export default updateUserDeviceRevoked;
