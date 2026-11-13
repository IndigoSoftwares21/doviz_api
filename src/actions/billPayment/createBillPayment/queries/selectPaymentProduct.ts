import { db } from "@/database";

/** Everything needed to charge for and submit a product (the schema has checked it's sellable). */
const selectPaymentProduct = async ({ productId }: { productId: string }) => {
    const productRow = await db
        .selectFrom("bill_products")
        .innerJoin("biller_provider_refs", "biller_provider_refs.id", "bill_products.billerProviderRefId")
        .innerJoin("billers", "billers.id", "biller_provider_refs.billerId")
        .select((eb) => [
            "bill_products.provider",
            "bill_products.providerProductRef",
            "bill_products.amountType",
            "bill_products.currency",
            "bill_products.price",
            "bill_products.serviceFee",
            "bill_products.providerFee",
            "billers.id as billerId",
            "billers.name as billerName",
            "billers.requiresValidation",
            eb.fn.coalesce("bill_products.displayName", "bill_products.name").as("productName"),
        ])
        .where("bill_products.id", "=", productId)
        .executeTakeFirstOrThrow();

    return productRow;
};

export default selectPaymentProduct;
