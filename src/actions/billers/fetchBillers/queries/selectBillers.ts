import { db } from "@/database";
import { BILLER_LINK_STATUS } from "@/constants/bills";

/** Our billers (names, logos, labels — never the provider's) that the given provider can sell right now. */
const selectBillers = async ({ provider, environment, category }: { provider: string; environment: string; category?: string }) => {
    let query = db
        .selectFrom("billers")
        .innerJoin("bill_categories", "bill_categories.code", "billers.categoryCode")
        .select([
            "billers.id",
            "billers.name",
            "billers.categoryCode as category",
            "billers.logoUrl",
            "billers.customerIdLabel",
            "billers.customerIdPattern",
            "billers.requiresValidation",
        ])
        .where("billers.isEnabled", "=", true)
        .where("bill_categories.isEnabled", "=", true)
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
        );

    if (category) query = query.where("billers.categoryCode", "=", category);

    const billerRows = await query.orderBy("bill_categories.sortOrder").orderBy("billers.sortOrder").orderBy("billers.name").execute();

    return billerRows;
};

export default selectBillers;
