import { withTransaction } from "@/database";
import billProviderRegistry from "@/services/bills/billProviderRegistry";
import createBillSettlement from "@/actions/billSettlement/createBillSettlement";
import createBillRefund from "@/actions/billRefund/createBillRefund";
import monitoring from "@/utils/monitoring";
import selectBillPaymentForSync from "./queries/selectBillPaymentForSync";
import updateBillPaymentChecked from "./queries/updateBillPaymentChecked";
import BILLS, { BILL_PAYMENT_STATUS, BILL_SYNC_OUTCOME, BillSyncOutcome, PROVIDER_BILL_STATUS } from "@/constants/bills";

const FINAL: string[] = [BILL_PAYMENT_STATUS.COMPLETED, BILL_PAYMENT_STATUS.FAILED];

/**
 * Brings one bill payment in line with the provider's OWN record (fetched
 * here, never taken from a webhook body). Safe to call any number of times:
 * settlement and refund each lock the row and do nothing once it's final.
 *
 * Not found at the provider: refunded after a grace period ONLY if our
 * request never got an answer. One the provider acknowledged is never
 * auto-refunded — it's flagged for a person, because refunding a payment
 * that was actually delivered would pay the bill twice.
 */
const syncBillPayment = async ({ billPaymentId }: { billPaymentId: string }) => {
    const payment = await selectBillPaymentForSync({ id: billPaymentId });
    if (!payment) throw new Error(`Bill payment ${billPaymentId} not found`);
    if (FINAL.includes(payment.status)) return { data: { outcome: BILL_SYNC_OUTCOME.UNCHANGED as BillSyncOutcome } };

    const record = await billProviderRegistry
        .get({ name: payment.provider })
        .getBillPayment({ externalId: payment.id, providerReference: payment.providerReference });

    const outcome = await withTransaction(async (trx): Promise<BillSyncOutcome> => {
        if (record?.status === PROVIDER_BILL_STATUS.COMPLETED) {
            const { data } = await createBillSettlement({ trx, billPaymentId: payment.id, record });
            return data.settled ? BILL_SYNC_OUTCOME.COMPLETED : BILL_SYNC_OUTCOME.UNCHANGED;
        }

        if (record?.status === PROVIDER_BILL_STATUS.FAILED) {
            const reason = "The biller couldn't complete this payment. Your money has been returned.";
            const { data } = await createBillRefund({ trx, billPaymentId: payment.id, reason });
            return data.refunded ? BILL_SYNC_OUTCOME.REFUNDED : BILL_SYNC_OUTCOME.UNCHANGED;
        }

        const overdue = Date.now() - payment.requestedAt.getTime() > BILLS.NOT_FOUND_REFUND_AFTER_MS;
        if (!record && overdue) {
            if (!payment.providerReference) {
                const reason = "This payment didn't go through. Your money has been returned.";
                const { data } = await createBillRefund({ trx, billPaymentId: payment.id, reason });
                return data.refunded ? BILL_SYNC_OUTCOME.REFUNDED : BILL_SYNC_OUTCOME.UNCHANGED;
            }
            await updateBillPaymentChecked({ trx, id: payment.id, providerReference: null });
            return BILL_SYNC_OUTCOME.NEEDS_REVIEW;
        }

        await updateBillPaymentChecked({ trx, id: payment.id, providerReference: record?.providerReference ?? null });
        return BILL_SYNC_OUTCOME.PENDING;
    });

    if (outcome === BILL_SYNC_OUTCOME.NEEDS_REVIEW) {
        monitoring.error(`Bill payment ${payment.id} (${payment.provider}) was acknowledged but can't be found — needs review`, new Error("bill payment not found"));
    }

    return { data: { outcome } };
};

export default syncBillPayment;
