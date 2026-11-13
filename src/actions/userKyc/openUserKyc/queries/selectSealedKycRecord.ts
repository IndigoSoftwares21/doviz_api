import { db } from "@/database";

/** One record's encrypted columns (only openUserKyc reads these). */
const selectSealedKycRecord = async ({ recordId }: { recordId: string }) => {
    const recordRow = await db
        .selectFrom("kyc_records")
        .select(["userId", "status", "keyVersion", "wrappedKey", "bvnEnc", "firstNameEnc", "middleNameEnc", "lastNameEnc", "dateOfBirthEnc", "genderEnc", "addressEnc"])
        .where("id", "=", recordId)
        .executeTakeFirst();

    return recordRow ?? null;
};

export default selectSealedKycRecord;
