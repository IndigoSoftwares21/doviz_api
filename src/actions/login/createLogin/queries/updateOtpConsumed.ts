import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateOtpConsumed {
    trx: Kysely<Database>;
    id: string;
    consumedAt: Date;
}

const updateOtpConsumed = async ({ trx, id, consumedAt }: IUpdateOtpConsumed) => {
    const otpRow = await trx
        .updateTable("phone_otps")
        .set({ consumedAt })
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return otpRow;
};

export default updateOtpConsumed;
