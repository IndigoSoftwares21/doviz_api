import findWebhookReceiver from "@/services/webhooks/findWebhookReceiver";
import syncDeposit from "@/actions/deposit/syncDeposit";
import syncBillPayment from "@/actions/billPayment/syncBillPayment";
import syncNairaDeposit from "@/actions/nairaDeposit/syncNairaDeposit";
import syncWithdrawal from "@/actions/withdrawal/syncWithdrawal";
import monitoring from "@/utils/monitoring";
import selectWebhookEvent from "./queries/selectWebhookEvent";
import updateWebhookEventAttempt from "./queries/updateWebhookEventAttempt";
import updateWebhookEventResult from "./queries/updateWebhookEventResult";
import selectBillPaymentIdByReference from "./queries/selectBillPaymentIdByReference";
import selectNairaDepositIdByReference from "./queries/selectNairaDepositIdByReference";
import selectWithdrawalIdByReference from "./queries/selectWithdrawalIdByReference";
import { SYNC_OUTCOME, WEBHOOK_EVENT_STATUS, WEBHOOK_RESOURCE_TYPE, WebhookEventStatus } from "@/constants/cryptoStatus";

const MAX_ATTEMPTS = 10;

/**
 * Processes one stored webhook event. The event only says WHAT changed —
 * syncDeposit / syncBillPayment / syncNairaDeposit re-fetch the provider's own record before
 * any money moves (syncWithdrawal for payouts). An event for a record we
 * don't have is ignored.
 */
const processWebhookEvent = async ({ id }: { id: string }) => {
    const event = await selectWebhookEvent({ id });
    if (!event || event.status === WEBHOOK_EVENT_STATUS.PROCESSED || event.status === WEBHOOK_EVENT_STATUS.IGNORED) {
        return { data: { status: event?.status ?? "missing" } };
    }

    const { attempts } = await updateWebhookEventAttempt({ id });

    try {
        const receiver = findWebhookReceiver({ name: event.provider });
        if (!receiver) throw new Error(`Provider "${event.provider}" is not registered`);
        const parsed = receiver.parseWebhook(event.payload);
        let status: WebhookEventStatus = WEBHOOK_EVENT_STATUS.IGNORED;

        if (parsed?.resourceType === WEBHOOK_RESOURCE_TYPE.DEPOSIT && parsed.resourceId) {
            const { data } = await syncDeposit({ provider: event.provider, reference: parsed.resourceId });
            status = data.outcome === SYNC_OUTCOME.IGNORED ? WEBHOOK_EVENT_STATUS.IGNORED : WEBHOOK_EVENT_STATUS.PROCESSED;
        }

        if (parsed?.resourceType === WEBHOOK_RESOURCE_TYPE.BILL_PAYMENT && parsed.resourceId) {
            const payment = await selectBillPaymentIdByReference({ provider: event.provider, reference: parsed.resourceId });
            if (payment) {
                await syncBillPayment({ billPaymentId: payment.id });
                status = WEBHOOK_EVENT_STATUS.PROCESSED;
            }
        }

        if (parsed?.resourceType === WEBHOOK_RESOURCE_TYPE.NAIRA_DEPOSIT && parsed.resourceId) {
            const deposit = await selectNairaDepositIdByReference({ provider: event.provider, reference: parsed.resourceId });
            if (deposit) {
                await syncNairaDeposit({ nairaDepositId: deposit.id });
                status = WEBHOOK_EVENT_STATUS.PROCESSED;
            }
        }

        if (parsed?.resourceType === WEBHOOK_RESOURCE_TYPE.PAYOUT && parsed.resourceId) {
            const withdrawal = await selectWithdrawalIdByReference({ provider: event.provider, reference: parsed.resourceId });
            if (withdrawal) {
                await syncWithdrawal({ withdrawalId: withdrawal.id });
                status = WEBHOOK_EVENT_STATUS.PROCESSED;
            }
        }

        await updateWebhookEventResult({ id, status, lastError: null });
        return { data: { status } };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await updateWebhookEventResult({ id, status: WEBHOOK_EVENT_STATUS.FAILED, lastError: message.slice(0, 500) });
        if (attempts >= MAX_ATTEMPTS) {
            monitoring.error(`Webhook event ${id} failed ${attempts} times — needs review`, error as Error);
        }
        return { data: { status: WEBHOOK_EVENT_STATUS.FAILED } };
    }
};

export default processWebhookEvent;
