import { db } from "@/database";

/** One of the user's own bill payments (never anyone else's). */
const selectBillPayment = async ({ id, userId }: { id: string; userId: string }) => {
    const paymentRow = await db
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
            "bill_payments.updatedAt",
            "billers.id as billerId",
            "billers.name as billerName",
            "billers.categoryCode as billerCategory",
            "billers.logoUrl as billerLogoUrl",
            "bill_products.id as productId",
            eb.fn.coalesce("bill_products.displayName", "bill_products.name").as("productName"),
        ])
        .where("bill_payments.id", "=", id)
        .where("bill_payments.userId", "=", userId)
        .executeTakeFirst();

    return paymentRow;
};

export default selectBillPayment;
