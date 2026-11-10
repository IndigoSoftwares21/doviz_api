import { db } from "@/database";
import { BILLER_LINK_STATUS } from "@/constants/bills";

/** An enabled biller with a confirmed, available link to the given provider. */
const selectListableBiller = async ({ billerId, provider, environment }: { billerId: string; provider: string; environment: string }) => {
    const billerRow = await db
        .selectFrom("billers")
        .innerJoin("biller_provider_refs", "biller_provider_refs.billerId", "billers.id")
        .select(["billers.id"])
        .where("billers.id", "=", billerId)
        .where("billers.isEnabled", "=", true)
        .where("biller_provider_refs.provider", "=", provider)
        .where("biller_provider_refs.environment", "=", environment)
        .where("biller_provider_refs.status", "=", BILLER_LINK_STATUS.CONFIRMED)
        .where("biller_provider_refs.isAvailable", "=", true)
        .executeTakeFirst();

    return billerRow;
};

export default selectListableBiller;
