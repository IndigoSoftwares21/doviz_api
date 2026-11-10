import { db } from "@/database";
import { BILLER_LINK_STATUS } from "@/constants/bills";

/** Of the given billers (by slug), the ones the given provider can sell right now. */
const selectNetworkBillers = async ({ slugs, provider, environment }: { slugs: string[]; provider: string; environment: string }) => {
    const billerRows = await db
        .selectFrom("billers")
        .select(["billers.id", "billers.slug", "billers.categoryCode"])
        .where("billers.slug", "in", slugs)
        .where("billers.isEnabled", "=", true)
        .where(({ exists, selectFrom }) =>
            exists(
                selectFrom("biller_provider_refs")
                    .innerJoin("bill_products", "bill_products.billerProviderRefId", "biller_provider_refs.id")
                    .select("biller_provider_refs.id")
                    .whereRef("biller_provider_refs.billerId", "=", "billers.id")
                    .where("biller_provider_refs.provider", "=", provider)
                    .where("biller_provider_refs.environment", "=", environment)
                    .where("biller_provider_refs.status", "=", BILLER_LINK_STATUS.CONFIRMED)
                    .where("biller_provider_refs.isAvailable", "=", true)
                    .where("bill_products.isAvailable", "=", true)
                    .where("bill_products.isEnabled", "=", true),
            ),
        )
        .execute();

    return billerRows;
};

export default selectNetworkBillers;
