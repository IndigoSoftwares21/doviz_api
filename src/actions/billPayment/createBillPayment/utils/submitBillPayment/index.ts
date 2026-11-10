import { withTransaction } from "@/database";
import billProviderRegistry from "@/services/bills/billProviderRegistry";
import BillProviderError from "@/services/bills/billProviderError";
import { Money } from "@/services/bills/types";
import createBillRefund from "@/actions/billRefund/createBillRefund";
import syncBillPayment from "@/actions/billPayment/syncBillPayment";
import monitoring from "@/utils/monitoring";
import updateBillPaymentSubmitted from "../../queries/updateBillPaymentSubmitted";
import updateBillPaymentProcessing from "../../queries/updateBillPaymentProcessing";
import { BILL_PROVIDER_ERROR_CODE, PROVIDER_BILL_STATUS } from "@/constants/bills";

const DECLINED = "The biller declined this payment. Your money has been returned.";
const UNAVAILABLE = "Bill payments are temporarily unavailable. Your money has been returned.";

/**
 * Sends an already-held payment to its provider. The money is safe whatever
 * happens here:
 *   accepted                     → stays pending until confirmed (webhook / reconciler / status read)
 *   rejected / configuration     → definitely not charged → refunded now
 *   anything else (timeout, 5xx) → outcome unknown → `processing`, never refunded on a guess
 */
const submitBillPayment = async ({
    billPaymentId,
    provider,
    providerProductRef,
    customerId,
    amount,
}: {
    billPaymentId: string;
    provider: string;
    providerProductRef: string;
    customerId: string;
    amount: Money;
}) => {
    try {
        const result = await billProviderRegistry.get({ name: provider }).payBill({ externalId: billPaymentId, providerProductRef, customerId, amount });
        await updateBillPaymentSubmitted({ id: billPaymentId, providerReference: result.providerReference, token: result.token });
        if (result.status !== PROVIDER_BILL_STATUS.PENDING) await syncBillPayment({ billPaymentId });
    } catch (error) {
        const code = error instanceof BillProviderError ? error.code : null;
        if (code === BILL_PROVIDER_ERROR_CODE.REJECTED || code === BILL_PROVIDER_ERROR_CODE.CONFIGURATION) {
            if (code === BILL_PROVIDER_ERROR_CODE.CONFIGURATION) {
                monitoring.error(`Bill payment ${billPaymentId}: ${provider} refused our setup — check credentials / IP whitelist`, error as Error);
            }
            const reason = code === BILL_PROVIDER_ERROR_CODE.REJECTED ? DECLINED : UNAVAILABLE;
            await withTransaction((trx) => createBillRefund({ trx, billPaymentId, reason }));
            return;
        }
        monitoring.warn(`Bill payment ${billPaymentId}: outcome unknown at ${provider} (${code ?? "error"}) — will reconcile`);
        await updateBillPaymentProcessing({ id: billPaymentId });
    }
};

export default submitBillPayment;
