import { db } from "@/database";

/** What a provider needs to check a customer for this product. */
const selectValidationProduct = async ({ productId }: { productId: string }) => {
    const productRow = await db
        .selectFrom("bill_products")
        .innerJoin("biller_provider_refs", "biller_provider_refs.id", "bill_products.billerProviderRefId")
        .innerJoin("billers", "billers.id", "biller_provider_refs.billerId")
        .select(["bill_products.providerProductRef", "billers.requiresValidation"])
        .where("bill_products.id", "=", productId)
        .executeTakeFirstOrThrow();

    return productRow;
};

export default selectValidationProduct;
