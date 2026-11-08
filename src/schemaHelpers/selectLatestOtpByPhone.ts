import { db } from "@/database";

const selectLatestOtpByPhone = async ({
    phoneNumber,
}: {
    phoneNumber: string;
}) => {
    const otpRow = await db
        .selectFrom("phone_otps")
        .select(["id", "createdAt"])
        .where("phoneNumber", "=", phoneNumber)
        .orderBy("createdAt", "desc")
        .limit(1)
        .executeTakeFirst();

    return otpRow;
};

export default selectLatestOtpByPhone;
