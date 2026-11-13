import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Claims an identifier (BVN, NIN…) for this user; false when another user holds it. Race-safe: the primary key decides. */
const claimIdentifier = async ({ trx, userId, fieldKey, lookupIndex }: { trx: Kysely<Database>; userId: string; fieldKey: string; lookupIndex: string }) => {
    await trx
        .insertInto("kyc_identifier_claims")
        .values({ fieldKey, lookupIndex, userId })
        .onConflict((oc) => oc.columns(["fieldKey", "lookupIndex"]).doNothing())
        .execute();
    const claim = await trx
        .selectFrom("kyc_identifier_claims")
        .select(["userId"])
        .where("fieldKey", "=", fieldKey)
        .where("lookupIndex", "=", lookupIndex)
        .executeTakeFirstOrThrow();
    return claim.userId === userId;
};

export default claimIdentifier;
