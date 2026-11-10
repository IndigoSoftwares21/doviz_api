import { db } from "@/database";
import { BILLER_LINK_STATUS } from "@/constants/bills";

/** Enabled categories that have at least one biller the given provider can sell right now. */
const selectBillCategories = async ({ provider, environment }: { provider: string; environment: string }) => {
    const categoryRows = await db
        .selectFrom("bill_categories")
        .select(["bill_categories.code", "bill_categories.name"])
        .where("bill_categories.isEnabled", "=", true)
        .where(({ exists, selectFrom }) =>
            exists(
                selectFrom("billers")
                    .innerJoin("biller_provider_refs", "biller_provider_refs.billerId", "billers.id")
                    .innerJoin("bill_products", "bill_products.billerProviderRefId", "biller_provider_refs.id")
                    .select("billers.id")
                    .whereRef("billers.categoryCode", "=", "bill_categories.code")
                    .where("billers.isEnabled", "=", true)
                    .where("biller_provider_refs.provider", "=", provider)
                    .where("biller_provider_refs.environment", "=", environment)
                    .where("biller_provider_refs.status", "=", BILLER_LINK_STATUS.CONFIRMED)
                    .where("biller_provider_refs.isAvailable", "=", true)
                    .where("bill_products.isAvailable", "=", true)
                    .where("bill_products.isEnabled", "=", true),
            ),
        )
        .orderBy("bill_categories.sortOrder")
        .execute();

    return categoryRows;
};

export default selectBillCategories;
