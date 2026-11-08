import { Kysely, sql } from "kysely";
import { Database } from "@/database/types";

interface IInsertUserDevice {
    trx: Kysely<Database>;
    userId: string;
    deviceId: string;
    deviceName: string | null;
    platform: string | null;
    lastIp: string | null;
    trustedAt: Date;
}

// An SMS login (re-)trusts the device — including one that was signed out
// or removed earlier. `xmax = 0` is true only for a brand-new device.
const insertUserDevice = async ({
    trx,
    userId,
    deviceId,
    deviceName,
    platform,
    lastIp,
    trustedAt,
}: IInsertUserDevice) => {
    const userDeviceRow = await trx
        .insertInto("user_devices")
        .values({ userId, deviceId, deviceName, platform, lastIp, lastSeenAt: trustedAt, trustedAt, revokedAt: null })
        .onConflict((oc) =>
            oc.columns(["userId", "deviceId"]).doUpdateSet((eb) => ({
                deviceName: eb.fn.coalesce(eb.ref("excluded.deviceName"), eb.ref("user_devices.deviceName")),
                platform: eb.fn.coalesce(eb.ref("excluded.platform"), eb.ref("user_devices.platform")),
                lastIp,
                lastSeenAt: trustedAt,
                trustedAt,
                revokedAt: null,
            })),
        )
        .returning(["id", "deviceId", sql<boolean>`xmax = 0`.as("isNewDevice")])
        .executeTakeFirstOrThrow();

    return userDeviceRow;
};

export default insertUserDevice;
