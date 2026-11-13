import { db } from "@/database";

/** The user's phone (E.164), confirmed by SMS code at sign-up — matched against the BVN record. */
const selectUserPhone = async ({ userId }: { userId: string }) => {
    const userRow = await db.selectFrom("users").select(["phoneNumber"]).where("id", "=", userId).executeTakeFirstOrThrow();
    return userRow.phoneNumber;
};

export default selectUserPhone;
