import { db } from "@/database";

/** The user's own bill payments, newest first. */
const selectBillPayments = async ({ userId, limit, offset }: { userId: string; limit: number; offset: number }) => {
    const paymentRows = await db
        .selectFrom("bill_payments")
        .innerJoin("billers", "billers.id", "bill_payments.billerId")
        .innerJoin("bill_products", "bill_products.id", "bill_payments.productId")
        .select((eb) => [
            "bill_payments.id",
            "bill_payments.status",
            "bill_payments.customerId",
            "bill_payments.customerName",
            "bill_payments.currency",
            "bill_payments.amount",
            "bill_payments.serviceFee",
            "bill_payments.total",
            "bill_payments.token",
            "bill_payments.failureReason",
            "bill_payments.createdAt",
            "bill_payments.finalizedAt",
            "billers.id as billerId",
            "billers.name as billerName",
            "billers.categoryCode as billerCategory",
            "billers.logoUrl as billerLogoUrl",
            "bill_products.id as productId",
            eb.fn.coalesce("bill_products.displayName", "bill_products.name").as("productName"),
        ])
        .where("bill_payments.userId", "=", userId)
        .orderBy("bill_payments.createdAt", "desc")
        .orderBy("bill_payments.id", "desc")
        .limit(limit)
        .offset(offset)
        .execute();

    return paymentRows;
};

export default selectBillPayments;
