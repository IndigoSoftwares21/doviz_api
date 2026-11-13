import { Kysely } from "kysely";
import { db } from "@/database";
import { Database } from "@/database/types";

/** The current (not superseded) row of each KYC field a user has on file — never the encrypted value. */
const selectCurrentKycFields = async ({ userId, trx = db }: { userId: string; trx?: Kysely<Database> }) => {
    const fieldRows = await trx
        .selectFrom("kyc_fields")
        .select(["id", "fieldKey", "lookupIndex", "displayHint", "createdAt"])
        .where("userId", "=", userId)
        .where("supersededAt", "is", null)
        .execute();

    return fieldRows;
};

export default selectCurrentKycFields;
