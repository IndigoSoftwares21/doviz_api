import { Kysely } from "kysely";
import { Database } from "@/database/types";

/**
 * Claims a BVN for this user. Returns false when another user already holds
 * it. Safe under races: the primary key decides who gets it.
 */
const claimBvn = async ({ trx, userId, bvnIndex }: { trx: Kysely<Database>; userId: string; bvnIndex: string }) => {
    await trx.insertInto("kyc_bvn_claims").values({ bvnIndex, userId }).onConflict((oc) => oc.column("bvnIndex").doNothing()).execute();
    const claim = await trx.selectFrom("kyc_bvn_claims").select(["userId"]).where("bvnIndex", "=", bvnIndex).executeTakeFirstOrThrow();
    return claim.userId === userId;
};

export default claimBvn;
