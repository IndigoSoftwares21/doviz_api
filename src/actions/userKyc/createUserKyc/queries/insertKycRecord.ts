import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { SealedKyc } from "@/services/kycVault/types";
import { KYC_STATUS, KycLevel } from "@/constants/kyc";

/** A new submission, in review. Its personal fields can never be changed after this. */
const insertKycRecord = async ({
    trx,
    userId,
    sealed,
    bvnIndex,
    bvnLast4,
    level,
}: {
    trx: Kysely<Database>;
    userId: string;
    sealed: SealedKyc;
    bvnIndex: string;
    bvnLast4: string;
    level: KycLevel;
}) => {
    const recordRow = await trx
        .insertInto("kyc_records")
        .values({ userId, status: KYC_STATUS.PENDING, level, bvnIndex, bvnLast4, ...sealed })
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return recordRow;
};

export default insertKycRecord;
