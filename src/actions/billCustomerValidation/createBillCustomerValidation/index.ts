import billProviderRegistry from "@/services/bills/billProviderRegistry";
import BillProviderError from "@/services/bills/billProviderError";
import monitoring from "@/utils/monitoring";
import fetchBillCustomer from "@/actions/billCustomerCheck/fetchBillCustomer";
import billCustomerMinimum from "@/utils/bills/billCustomerMinimum";
import selectValidationProduct from "./queries/selectValidationProduct";
import ACTION_FAILURE from "@/constants/actionFailure";
import { BILL_PROVIDER_ERROR_CODE } from "@/constants/bills";

/**
 * Checks the meter / smartcard / account number with the active provider and
 * returns the name on it. Billers that don't need it (airtime, data) answer
 * at once with no name. A provider "no such customer" is the user's to fix;
 * anything else (our setup, outages) is ours and reported as unavailable.
 */
const createBillCustomerValidation = async ({ productId, customerId }: { productId: string; customerId: string }) => {
    const provider = billProviderRegistry.active();
    const product = await selectValidationProduct({ productId });

    if (!product.requiresValidation) {
        return { data: { customerName: null, address: null, minAmount: null, maxAmount: null }, failure: null };
    }

    try {
        const customer = await fetchBillCustomer({ provider: provider.name, productId, providerProductRef: product.providerProductRef, customerId });
        const minAmount = billCustomerMinimum({ minAmount: customer.minAmount, providerFee: product.providerFee });
        return { data: { ...customer, minAmount }, failure: null };
    } catch (error) {
        const code = error instanceof BillProviderError ? error.code : null;
        if (code === BILL_PROVIDER_ERROR_CODE.REJECTED || code === BILL_PROVIDER_ERROR_CODE.NOT_FOUND) {
            return { data: null, failure: ACTION_FAILURE.CUSTOMER_NOT_FOUND };
        }
        monitoring.error(`Bill customer validation failed (${provider.name})`, error as Error);
        return { data: null, failure: ACTION_FAILURE.PROVIDER_UNAVAILABLE };
    }
};

export default createBillCustomerValidation;
