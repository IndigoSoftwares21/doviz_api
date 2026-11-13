import selectKycSummaries from "./queries/selectKycSummaries";
import { KYC_STATUS } from "@/constants/kyc";

/** No submission yet. */
export const KYC_NOT_STARTED = "not_started";

/**
 * A user's KYC as the app (and every other feature) sees it — nothing here is
 * decrypted. `status` is what matters now: a submission in review, else the
 * verification in force, else the last rejection. `recordId` is the record in
 * force, for anything that must say which verification it relied on.
 */
const fetchUserKyc = async ({ userId }: { userId: string }) => {
    const { active, latest } = await selectKycSummaries({ userId });
    const current = latest?.status === KYC_STATUS.PENDING ? latest : (active ?? latest);

    if (!current) {
        return { data: { status: KYC_NOT_STARTED, level: null, recordId: null, bvn: null, rejectionReason: null, submittedAt: null, verifiedAt: null } };
    }
    return {
        data: {
            status: current.status,
            /** The level verified at — null until one is. */
            level: active?.level ?? null,
            recordId: active?.id ?? null,
            bvn: `•••••••${current.bvnLast4}`,
            rejectionReason: current.status === KYC_STATUS.REJECTED ? current.rejectionReason : null,
            submittedAt: current.submittedAt,
            verifiedAt: active?.decidedAt ?? null,
        },
    };
};

export default fetchUserKyc;
