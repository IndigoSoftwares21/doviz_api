import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { KYC_STATUS } from "@/constants/kyc";

/** A new verification attempt, in review, linked to exactly the field rows it will check. */
const insertKycRecord = async ({ trx, userId, level, fields }: { trx: Kysely<Database>; userId: string; level: string; fields: { fieldKey: string; id: string }[] }) => {
    const record = await trx
        .insertInto("kyc_records")
        .values({ userId, status: KYC_STATUS.PENDING, level })
        .returning(["id"])
        .executeTakeFirstOrThrow();
    await trx
        .insertInto("kyc_record_fields")
        .values(fields.map(({ fieldKey, id }) => ({ recordId: record.id, fieldId: id, fieldKey })))
        .execute();
    return record;
};

export default insertKycRecord;
