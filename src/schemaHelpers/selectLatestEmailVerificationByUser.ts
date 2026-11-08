import { db } from "@/database";

const selectLatestEmailVerificationByUser = async ({ userId }: { userId: string }) => {
    const emailVerificationRow = await db
        .selectFrom("email_verifications")
        .select(["id", "createdAt"])
        .where("userId", "=", userId)
        .orderBy("createdAt", "desc")
        .limit(1)
        .executeTakeFirst();

    return emailVerificationRow;
};

export default selectLatestEmailVerificationByUser;
