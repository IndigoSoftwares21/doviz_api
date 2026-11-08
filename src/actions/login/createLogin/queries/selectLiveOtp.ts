import { Kysely } from "kysely";
import { Database } from "@/database/types";

interface ISelectLiveOtp {
    trx: Kysely<Database>;
    phoneNumber: string;
    purpose: string;
    now: Date;
}

// FOR UPDATE serialises concurrent verifications of the same OTP so each
// guess is counted and a code can only be consumed once.
const selectLiveOtp = async ({ trx, phoneNumber, purpose, now }: ISelectLiveOtp) => {
    const otpRow = await trx
        .selectFrom("phone_otps")
        .select(["id", "codeHash", "attempts", "maxAttempts"])
        .where("phoneNumber", "=", phoneNumber)
        .where("purpose", "=", purpose)
        .where("consumedAt", "is", null)
        .where("revokedAt", "is", null)
        .where("expiresAt", ">", now)
        .whereRef("attempts", "<", "maxAttempts")
        .orderBy("createdAt", "desc")
        .limit(1)
        .forUpdate()
        .executeTakeFirst();

    return otpRow;
};

export default selectLiveOtp;
