import { db } from "@/database";
import { ProviderWebhookEvent } from "@/services/crypto/types";
import { WEBHOOK_EVENT_STATUS } from "@/constants/cryptoStatus";

interface IInsertProviderWebhookEvent {
    provider: string;
    event: ProviderWebhookEvent;
    payload: unknown;
    sourceIp: string | null;
}

/** Returns undefined for a duplicate (same provider + event id): providers deliver at least once. */
const insertProviderWebhookEvent = async ({ provider, event, payload, sourceIp }: IInsertProviderWebhookEvent) => {
    const eventRow = await db
        .insertInto("provider_webhook_events")
        .values({
            provider,
            eventId: event.eventId,
            eventName: event.eventName,
            resourceId: event.resourceId,
            eventTime: event.eventTime,
            payload: JSON.stringify(payload),
            sourceIp,
            status: WEBHOOK_EVENT_STATUS.RECEIVED,
            attempts: 0,
            lastError: null,
            processedAt: null,
        })
        .onConflict((oc) => oc.columns(["provider", "eventId"]).doNothing())
        .returning(["id"])
        .executeTakeFirst();

    return eventRow;
};

export default insertProviderWebhookEvent;
