import { db } from "@/database";

const selectEmailVerificationCountByUser = async ({
    userId,
    since,
}: {
    userId: string;
    since: Date;
}) => {
    const emailVerificationCountRow = await db
        .selectFrom("email_verifications")
        .select((eb) => eb.fn.countAll<string>().as("emailVerificationCount"))
        .where("userId", "=", userId)
        .where("createdAt", ">=", since)
        .executeTakeFirst();

    return emailVerificationCountRow;
};

export default selectEmailVerificationCountByUser;
