import { db } from "@/database";
import { KYC_STATUS } from "@/constants/kyc";

/** Read-only: the user's open attempts, and who holds the given identifiers (for a check before paying a verifier). */
const selectAttemptBlockers = async ({ userId, identifiers }: { userId: string; identifiers: { fieldKey: string; lookupIndex: string }[] }) => {
    const [open, claims] = await Promise.all([
        db.selectFrom("kyc_records").select(["status", "level"]).where("userId", "=", userId).where("status", "in", [KYC_STATUS.PENDING, KYC_STATUS.VERIFIED]).execute(),
        identifiers.length
            ? db
                  .selectFrom("kyc_identifier_claims")
                  .select(["fieldKey", "userId"])
                  .where((eb) => eb.or(identifiers.map(({ fieldKey, lookupIndex }) => eb.and([eb("fieldKey", "=", fieldKey), eb("lookupIndex", "=", lookupIndex)]))))
                  .execute()
            : Promise.resolve([]),
    ]);
    return { open, claims };
};

export default selectAttemptBlockers;
