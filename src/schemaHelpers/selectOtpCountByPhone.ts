import { db } from "@/database";

const selectOtpCountByPhone = async ({
    phoneNumber,
    since,
}: {
    phoneNumber: string;
    since: Date;
}) => {
    const otpCountRow = await db
        .selectFrom("phone_otps")
        .select((eb) => eb.fn.countAll<string>().as("otpCount"))
        .where("phoneNumber", "=", phoneNumber)
        .where("createdAt", ">=", since)
        .executeTakeFirst();

    return otpCountRow;
};

export default selectOtpCountByPhone;
