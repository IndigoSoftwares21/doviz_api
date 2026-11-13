import { db } from "@/database";

/** The encrypted current rows of the given fields (only openCurrentKycValues reads these). */
const selectSealedCurrentFields = async ({ userId, keys }: { userId: string; keys: string[] }) => {
    if (!keys.length) return [];
    const fieldRows = await db
        .selectFrom("kyc_fields")
        .select(["id", "fieldKey", "keyVersion", "wrappedKey", "valueEnc"])
        .where("userId", "=", userId)
        .where("fieldKey", "in", keys)
        .where("supersededAt", "is", null)
        .execute();

    return fieldRows;
};

export default selectSealedCurrentFields;
