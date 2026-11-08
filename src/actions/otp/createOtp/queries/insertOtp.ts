import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface IInsertOtp {
    trx: Kysely<Database>;
    phoneNumber: string;
    purpose: string;
    codeHash: string;
    maxAttempts: number;
    expiresAt: Date;
    requestIp: string | null;
    userAgent: string | null;
}

const insertOtp = async ({
    trx,
    phoneNumber,
    purpose,
    codeHash,
    maxAttempts,
    expiresAt,
    requestIp,
    userAgent,
}: IInsertOtp) => {
    const otpRow = await trx
        .insertInto("phone_otps")
        .values({
            phoneNumber,
            purpose,
            codeHash,
            attempts: 0,
            maxAttempts,
            expiresAt,
            requestIp,
            userAgent,
        })
        .returning(["id", "expiresAt"])
        .executeTakeFirstOrThrow();

    return otpRow;
};

export default insertOtp;
