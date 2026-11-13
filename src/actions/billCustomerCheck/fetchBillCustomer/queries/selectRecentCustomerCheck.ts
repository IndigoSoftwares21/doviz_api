import { db } from "@/database";

/** The last successful check of this customer for this product, if made since `since`. */
const selectRecentCustomerCheck = async ({ productId, customerId, since }: { productId: string; customerId: string; since: Date }) => {
    const checkRow = await db
        .selectFrom("bill_customer_checks")
        .select(["customerName", "address", "minAmount", "maxAmount"])
        .where("productId", "=", productId)
        .where("customerId", "=", customerId)
        .where("checkedAt", ">=", since)
        .executeTakeFirst();

    return checkRow ?? null;
};

export default selectRecentCustomerCheck;
