import { db } from "@/database";
import { ProviderCustomer } from "@/services/bills/types";

/** Records a successful check (replacing any older one for the same customer and product). */
const upsertCustomerCheck = async ({ productId, customerId, customer }: { productId: string; customerId: string; customer: ProviderCustomer }) => {
    const values = {
        customerName: customer.customerName?.slice(0, 150) ?? null,
        address: customer.address,
        minAmount: customer.minAmount,
        maxAmount: customer.maxAmount,
        checkedAt: new Date(),
    };
    await db
        .insertInto("bill_customer_checks")
        .values({ productId, customerId, ...values })
        .onConflict((oc) => oc.columns(["productId", "customerId"]).doUpdateSet(values))
        .execute();
};

export default upsertCustomerCheck;
