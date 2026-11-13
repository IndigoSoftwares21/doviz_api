import { db } from "@/database";

/** The names on the user's profile (not KYC data) — used only to pre-fill the form. */
const selectProfileNames = async ({ userId }: { userId: string }) => {
    const userRow = await db.selectFrom("users").select(["firstName", "middleName", "lastName"]).where("id", "=", userId).executeTakeFirst();
    return userRow ?? null;
};

export default selectProfileNames;
