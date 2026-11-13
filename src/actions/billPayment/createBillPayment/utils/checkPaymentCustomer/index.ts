import Decimal from "decimal.js";
import fetchBillCustomer from "@/actions/billCustomerCheck/fetchBillCustomer";
import BillProviderError from "@/services/bills/billProviderError";
import monitoring from "@/utils/monitoring";
import billCustomerMinimum from "@/utils/bills/billCustomerMinimum";
import ACTION_FAILURE from "@/constants/actionFailure";
import { BILL_PROVIDER_ERROR_CODE } from "@/constants/bills";

/**
 * For billers that need it (meters, smartcards), confirms the customer with
 * the provider BEFORE any money is held — the server's own check, whatever
 * the app did — and applies that customer's own limits (e.g. a minimum
 * vend for this meter). Returns the name on the account to keep with the payment.
 */
const checkPaymentCustomer = async ({
    provider,
    productId,
    providerProductRef,
    providerFee,
    requiresValidation,
    customerId,
    amount,
}: {
    provider: string;
    productId: string;
    providerProductRef: string;
    providerFee: string;
    requiresValidation: boolean;
    customerId: string;
    amount: string;
}) => {
    if (!requiresValidation) return { customerName: null, failure: null, limits: null };

    try {
        const customer = await fetchBillCustomer({ provider, productId, providerProductRef, customerId });
        const minAmount = billCustomerMinimum({ minAmount: customer.minAmount, providerFee });
        const limits = { minAmount, maxAmount: customer.maxAmount };
        const tooLow = minAmount !== null && new Decimal(amount).lessThan(minAmount);
        const tooHigh = customer.maxAmount !== null && new Decimal(amount).greaterThan(customer.maxAmount);
        if (tooLow || tooHigh) return { customerName: customer.customerName, failure: ACTION_FAILURE.AMOUNT_OUT_OF_RANGE, limits };
        return { customerName: customer.customerName, failure: null, limits };
    } catch (error) {
        const code = error instanceof BillProviderError ? error.code : null;
        if (code === BILL_PROVIDER_ERROR_CODE.REJECTED || code === BILL_PROVIDER_ERROR_CODE.NOT_FOUND) {
            return { customerName: null, failure: ACTION_FAILURE.CUSTOMER_NOT_FOUND, limits: null };
        }
        monitoring.error(`Bill payment: customer check failed (${provider}) — not charging`, error as Error);
        return { customerName: null, failure: ACTION_FAILURE.PROVIDER_UNAVAILABLE, limits: null };
    }
};

export default checkPaymentCustomer;
