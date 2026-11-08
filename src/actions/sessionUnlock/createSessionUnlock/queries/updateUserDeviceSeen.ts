import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateUserDeviceSeen {
    trx: Kysely<Database>;
    userDeviceId: string;
    lastSeenAt: Date;
    lastIp: string | null;
}

const updateUserDeviceSeen = async ({ trx, userDeviceId, lastSeenAt, lastIp }: IUpdateUserDeviceSeen) => {
    const userDeviceRow = await trx
        .updateTable("user_devices")
        .set({ lastSeenAt, lastIp })
        .where("id", "=", userDeviceId)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return userDeviceRow;
};

export default updateUserDeviceSeen;
