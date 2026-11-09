import providerRegistry from "@/services/crypto/providerRegistry";
import syncDeposit from "@/actions/deposit/syncDeposit";
import monitoring from "@/utils/monitoring";
import selectWebhookEvent from "./queries/selectWebhookEvent";
import updateWebhookEventAttempt from "./queries/updateWebhookEventAttempt";
import updateWebhookEventResult from "./queries/updateWebhookEventResult";
import { SYNC_OUTCOME, WEBHOOK_EVENT_STATUS, WEBHOOK_RESOURCE_TYPE, WebhookEventStatus } from "@/constants/cryptoStatus";

const MAX_ATTEMPTS = 10;

/**
 * Processes one stored webhook event. The event only says WHAT changed —
 * syncDeposit re-fetches the provider's own record before any money moves.
 * Payout events are ignored until withdrawals exist.
 */
const processWebhookEvent = async ({ id }: { id: string }) => {
    const event = await selectWebhookEvent({ id });
    if (!event || event.status === WEBHOOK_EVENT_STATUS.PROCESSED || event.status === WEBHOOK_EVENT_STATUS.IGNORED) {
        return { data: { status: event?.status ?? "missing" } };
    }

    const { attempts } = await updateWebhookEventAttempt({ id });

    try {
        const parsed = providerRegistry.get({ name: event.provider }).parseWebhook(event.payload);
        let status: WebhookEventStatus = WEBHOOK_EVENT_STATUS.IGNORED;

        if (parsed?.resourceType === WEBHOOK_RESOURCE_TYPE.DEPOSIT && parsed.resourceId) {
            const { data } = await syncDeposit({ provider: event.provider, reference: parsed.resourceId });
            status = data.outcome === SYNC_OUTCOME.IGNORED ? WEBHOOK_EVENT_STATUS.IGNORED : WEBHOOK_EVENT_STATUS.PROCESSED;
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
