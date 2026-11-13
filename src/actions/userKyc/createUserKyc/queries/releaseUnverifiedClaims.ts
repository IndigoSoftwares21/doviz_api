import { Kysely, sql } from "kysely";
import { Database } from "@/database/types";
import { KYC_STATUS } from "@/constants/kyc";

/**
 * After a rejection: lets go of this user's identifier claims that no
 * verification of theirs relies on — so a BVN typed by mistake (or someone
 * else's) doesn't stay blocked for its real owner.
 */
const releaseUnverifiedClaims = async ({ trx, userId }: { trx: Kysely<Database>; userId: string }) => {
    await trx
        .deleteFrom("kyc_identifier_claims")
        .where("kyc_identifier_claims.userId", "=", userId)
        .where(({ not, exists, selectFrom }) =>
            not(
                exists(
                    selectFrom("kyc_record_fields")
                        .innerJoin("kyc_fields", "kyc_fields.id", "kyc_record_fields.fieldId")
                        .innerJoin("kyc_records", "kyc_records.id", "kyc_record_fields.recordId")
                        .select(sql`1`.as("one"))
                        .where("kyc_records.userId", "=", userId)
                        .where("kyc_records.status", "=", KYC_STATUS.VERIFIED)
                        .whereRef("kyc_fields.fieldKey", "=", "kyc_identifier_claims.fieldKey")
                        .whereRef("kyc_fields.lookupIndex", "=", "kyc_identifier_claims.lookupIndex"),
                ),
            ),
        )
        .execute();
};

export default releaseUnverifiedClaims;
