import { db } from "@/database";
import { BILLER_LINK_STATUS } from "@/constants/bills";

/** A product the given provider can sell right now, with its biller's customer-id rules. */
const selectListableBillProduct = async ({ productId, provider, environment }: { productId: string; provider: string; environment: string }) => {
    const productRow = await db
        .selectFrom("bill_products")
        .innerJoin("biller_provider_refs", "biller_provider_refs.id", "bill_products.billerProviderRefId")
        .innerJoin("billers", "billers.id", "biller_provider_refs.billerId")
        .select(["bill_products.id", "billers.customerIdLabel", "billers.customerIdPattern"])
        .where("bill_products.id", "=", productId)
        .where("bill_products.provider", "=", provider)
        .where("bill_products.environment", "=", environment)
        .where("bill_products.isAvailable", "=", true)
        .where("bill_products.isEnabled", "=", true)
        .where("biller_provider_refs.status", "=", BILLER_LINK_STATUS.CONFIRMED)
        .where("biller_provider_refs.isAvailable", "=", true)
        .where("billers.isEnabled", "=", true)
        .executeTakeFirst();

    return productRow;
};

export default selectListableBillProduct;
