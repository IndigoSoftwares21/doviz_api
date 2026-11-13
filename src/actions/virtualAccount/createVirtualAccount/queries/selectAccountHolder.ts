import { db } from "@/database";

/** What the provider needs beyond KYC: the verification in force, and the verified phone and email. */
const selectAccountHolder = async ({ userId }: { userId: string }) => {
    const userRow = await db.selectFrom("users").select(["activeKycRecordId", "phoneNumber", "email"]).where("id", "=", userId).executeTakeFirstOrThrow();
    return userRow;
};

export default selectAccountHolder;
