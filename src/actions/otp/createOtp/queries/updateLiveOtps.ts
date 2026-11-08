import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateLiveOtps {
    trx: Kysely<Database>;
    phoneNumber: string;
    purpose: string;
    revokedAt: Date;
}

// Revokes every unconsumed/unrevoked OTP (expired or not) so only the newest
// code is ever valid, and the one-live-OTP unique index stays satisfied.
const updateLiveOtps = async ({
    trx,
    phoneNumber,
    purpose,
    revokedAt,
}: IUpdateLiveOtps) => {
    const revokedRows = await trx
        .updateTable("phone_otps")
        .set({ revokedAt })
        .where("phoneNumber", "=", phoneNumber)
        .where("purpose", "=", purpose)
        .where("consumedAt", "is", null)
        .where("revokedAt", "is", null)
        .returning(["id"])
        .execute();

    return revokedRows;
};

export default updateLiveOtps;
