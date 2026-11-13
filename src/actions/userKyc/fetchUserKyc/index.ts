import fetchCurrentKycFields from "@/actions/kycFields/fetchCurrentKycFields";
import selectKycAttempts from "./queries/selectKycAttempts";
import { KYC_STATUS } from "@/constants/kyc";

/** No attempt yet. */
export const KYC_NOT_STARTED = "not_started";

/**
 * A user's KYC as the app (and every other feature) sees it — nothing is
 * decrypted. `status`: an attempt in review, else the verification in force,
 * else the last rejection. `recordId` is the verification in force, for
 * anything that must say which one it relied on.
 */
const fetchUserKyc = async ({ userId }: { userId: string }) => {
    const [{ active, latest }, { data: fields }] = await Promise.all([selectKycAttempts({ userId }), fetchCurrentKycFields({ userId })]);
    const current = latest?.status === KYC_STATUS.PENDING ? latest : (active ?? latest);
    const bvnHint = fields.get("bvn")?.displayHint;

    return {
        data: {
            status: current?.status ?? KYC_NOT_STARTED,
            /** The level verified at — null until one is. */
            level: active?.level ?? null,
            recordId: active?.id ?? null,
            bvn: bvnHint ? `•••••••${bvnHint}` : null,
            rejectionReason: current?.status === KYC_STATUS.REJECTED ? current.rejectionReason : null,
            submittedAt: current?.submittedAt ?? null,
            verifiedAt: active?.decidedAt ?? null,
        },
    };
};

export default fetchUserKyc;
