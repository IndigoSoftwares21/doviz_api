import { db } from "@/database";
import { WEBHOOK_EVENT_STATUS, WebhookEventStatus } from "@/constants/cryptoStatus";

interface IUpdateWebhookEventResult {
    id: string;
    status: Exclude<WebhookEventStatus, typeof WEBHOOK_EVENT_STATUS.RECEIVED>;
    lastError: string | null;
}

const updateWebhookEventResult = async ({ id, status, lastError }: IUpdateWebhookEventResult) => {
    const eventRow = await db
        .updateTable("provider_webhook_events")
        .set({ status, lastError, processedAt: status === WEBHOOK_EVENT_STATUS.FAILED ? null : new Date() })
        .where("id", "=", id)
        .returning(["id", "status"])
        .executeTakeFirstOrThrow();

    return eventRow;
};

export default updateWebhookEventResult;
