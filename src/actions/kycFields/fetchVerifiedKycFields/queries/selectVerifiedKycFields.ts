import { Kysely } from "kysely";
import { db } from "@/database";
import { Database } from "@/database/types";

/** The field rows the user's verification in force was checked against — never the encrypted value. */
const selectVerifiedKycFields = async ({ userId, trx = db }: { userId: string; trx?: Kysely<Database> }) => {
    const fieldRows = await trx
        .selectFrom("users")
        .innerJoin("kyc_record_fields", "kyc_record_fields.recordId", "users.activeKycRecordId")
        .innerJoin("kyc_fields", "kyc_fields.id", "kyc_record_fields.fieldId")
        .select(["kyc_fields.id", "kyc_fields.fieldKey", "kyc_fields.lookupIndex", "kyc_fields.displayHint"])
        .where("users.id", "=", userId)
        .execute();

    return fieldRows;
};

export default selectVerifiedKycFields;
