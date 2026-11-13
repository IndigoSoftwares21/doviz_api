import { db } from "@/database";

/** The record, and the encrypted field rows it was checked against (only openUserKyc reads these). */
const selectSealedRecordFields = async ({ recordId }: { recordId: string }) => {
    const record = await db.selectFrom("kyc_records").select(["userId", "status", "level"]).where("id", "=", recordId).executeTakeFirst();
    if (!record) return null;
    const fields = await db
        .selectFrom("kyc_record_fields")
        .innerJoin("kyc_fields", "kyc_fields.id", "kyc_record_fields.fieldId")
        .select(["kyc_fields.id", "kyc_fields.fieldKey", "kyc_fields.keyVersion", "kyc_fields.wrappedKey", "kyc_fields.valueEnc"])
        .where("kyc_record_fields.recordId", "=", recordId)
        .execute();
    return { ...record, fields };
};

export default selectSealedRecordFields;
