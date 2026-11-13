import { db } from "@/database";

const SUMMARY = ["kyc_records.id", "kyc_records.status", "kyc_records.level", "kyc_records.bvnLast4", "kyc_records.rejectionReason", "kyc_records.submittedAt", "kyc_records.decidedAt"] as const;

/**
 * The verification in force (via users.active_kyc_record_id) and the user's
 * latest submission — non-secret columns only, never an encrypted one.
 */
const selectKycSummaries = async ({ userId }: { userId: string }) => {
    const [active, latest] = await Promise.all([
        db
            .selectFrom("users")
            .innerJoin("kyc_records", "kyc_records.id", "users.activeKycRecordId")
            .select(SUMMARY)
            .where("users.id", "=", userId)
            .executeTakeFirst(),
        db.selectFrom("kyc_records").select(SUMMARY).where("userId", "=", userId).orderBy("submittedAt", "desc").limit(1).executeTakeFirst(),
    ]);

    return { active: active ?? null, latest: latest ?? null };
};

export default selectKycSummaries;
