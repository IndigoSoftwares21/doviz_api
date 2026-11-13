import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { KycVerification } from "@/services/kycVerification/kycVerifier";
import { KYC_STATUS } from "@/constants/kyc";

/**
 * Records the verifier's decision on an attempt. Verified: it becomes the
 * verification in force (an older one is superseded). Evidence holds match
 * results and scores only.
 */
const decideKycRecord = async ({ trx, userId, recordId, decidedBy, verification }: { trx: Kysely<Database>; userId: string; recordId: string; decidedBy: string; verification: KycVerification }) => {
    const verified = verification.outcome === KYC_STATUS.VERIFIED;
    const now = new Date();
    if (verified) {
        await trx
            .updateTable("kyc_records")
            .set({ status: KYC_STATUS.SUPERSEDED, supersededAt: now, updatedAt: now })
            .where("userId", "=", userId)
            .where("status", "=", KYC_STATUS.VERIFIED)
            .execute();
    }
    await trx
        .updateTable("kyc_records")
        .set({
            status: verified ? KYC_STATUS.VERIFIED : KYC_STATUS.REJECTED,
            decidedAt: now,
            decidedBy,
            providerReference: verification.reference?.slice(0, 128) ?? null,
            evidence: JSON.stringify(verification.evidence),
            rejectionReason: verified ? null : (verification.reason ?? "We couldn't verify your details.").slice(0, 255),
            updatedAt: now,
        })
        .where("id", "=", recordId)
        .execute();
    if (verified) await trx.updateTable("users").set({ activeKycRecordId: recordId }).where("id", "=", userId).execute();
};

export default decideKycRecord;
