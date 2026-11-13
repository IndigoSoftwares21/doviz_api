import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { KYC_STATUS } from "@/constants/kyc";

/** The user's in-review and in-force attempts, with the user row locked so their submissions run one at a time. */
const selectOpenKycRecords = async ({ trx, userId }: { trx: Kysely<Database>; userId: string }) => {
    await trx.selectFrom("users").select(["id"]).where("id", "=", userId).forUpdate().executeTakeFirstOrThrow();
    const recordRows = await trx
        .selectFrom("kyc_records")
        .select(["id", "status", "level"])
        .where("userId", "=", userId)
        .where("status", "in", [KYC_STATUS.PENDING, KYC_STATUS.VERIFIED])
        .execute();

    return recordRows;
};

export default selectOpenKycRecords;
