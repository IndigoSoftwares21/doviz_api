import { db } from "@/database";

/** The encrypted rows with these ids, if they're this user's (only openKycFieldValues reads these). */
const selectSealedFields = async ({ userId, ids }: { userId: string; ids: string[] }) => {
    if (!ids.length) return [];
    const fieldRows = await db
        .selectFrom("kyc_fields")
        .select(["id", "fieldKey", "keyVersion", "wrappedKey", "valueEnc"])
        .where("userId", "=", userId)
        .where("id", "in", ids)
        .execute();

    return fieldRows;
};

export default selectSealedFields;
