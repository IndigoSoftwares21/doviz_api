import { db } from "@/database";
import { BILLER_LINK_STATUS } from "@/constants/bills";

/**
 * The given provider's sellable products for one of our billers. The name is
 * our manual override when set, else the sync's cleaned name — never the raw one.
 * Any-amount products first, then by price.
 */
const selectBillProducts = async ({ billerId, provider, environment }: { billerId: string; provider: string; environment: string }) => {
    const productRows = await db
        .selectFrom("bill_products")
        .innerJoin("biller_provider_refs", "biller_provider_refs.id", "bill_products.billerProviderRefId")
        .select((eb) => [
            "bill_products.id",
            eb.fn.coalesce("bill_products.displayName", "bill_products.name").as("name"),
            "bill_products.amountType",
            "bill_products.currency",
            "bill_products.price",
            "bill_products.minAmount",
            "bill_products.maxAmount",
            "bill_products.serviceFee",
            "bill_products.validityDays",
        ])
        .where("biller_provider_refs.billerId", "=", billerId)
        .where("biller_provider_refs.provider", "=", provider)
        .where("biller_provider_refs.environment", "=", environment)
        .where("biller_provider_refs.status", "=", BILLER_LINK_STATUS.CONFIRMED)
        .where("biller_provider_refs.isAvailable", "=", true)
        .where("bill_products.isAvailable", "=", true)
        .where("bill_products.isEnabled", "=", true)
        .orderBy("bill_products.amountType", "desc")
        .orderBy("bill_products.price")
        .orderBy("bill_products.name")
        .execute();

    return productRows;
};

export default selectBillProducts;
