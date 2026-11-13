import billProviderRegistry from "@/services/bills/billProviderRegistry";
import { ProviderCustomer } from "@/services/bills/types";
import monitoring from "@/utils/monitoring";
import BILLS from "@/constants/bills";
import selectRecentCustomerCheck from "./queries/selectRecentCustomerCheck";
import upsertCustomerCheck from "./queries/upsertCustomerCheck";

/**
 * The customer behind a meter / smartcard number, for any provider. Reuses a
 * successful check from the last BILLS.CUSTOMER_CHECK_REUSE_MS — some billers
 * answer their check unreliably, so a payment made right after the app's own
 * check must not fail on a second ask. Otherwise asks the provider (its
 * BillProviderError propagates) and remembers a success. Failures are never
 * remembered: a wrong number is always re-checked.
 */
const fetchBillCustomer = async ({
    provider,
    productId,
    providerProductRef,
    customerId,
}: {
    provider: string;
    productId: string;
    providerProductRef: string;
    customerId: string;
}): Promise<ProviderCustomer> => {
    const since = new Date(Date.now() - BILLS.CUSTOMER_CHECK_REUSE_MS);
    const recent = await selectRecentCustomerCheck({ productId, customerId, since });
    if (recent) return recent;

    const customer = await billProviderRegistry.get({ name: provider }).validateCustomer({ providerProductRef, customerId });
    // Remembering is a convenience: a failure here must never fail the check itself.
    await upsertCustomerCheck({ productId, customerId, customer }).catch((error) =>
        monitoring.warn(`Couldn't remember the customer check for product ${productId}: ${(error as Error).message}`),
    );
    return customer;
};

export default fetchBillCustomer;
