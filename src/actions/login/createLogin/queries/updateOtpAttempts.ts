import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IUpdateOtpAttempts {
    trx: Kysely<Database>;
    id: string;
    attempts: number;
    revokedAt: Date | null;
}

const updateOtpAttempts = async ({ trx, id, attempts, revokedAt }: IUpdateOtpAttempts) => {
    const otpRow = await trx
        .updateTable("phone_otps")
        .set({ attempts, revokedAt })
        .where("id", "=", id)
        .returning(["id", "attempts"])
        .executeTakeFirstOrThrow();

    return otpRow;
};

export default updateOtpAttempts;
