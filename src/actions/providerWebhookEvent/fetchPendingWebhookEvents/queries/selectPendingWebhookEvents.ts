import { db } from "@/database";
import { WEBHOOK_EVENT_STATUS } from "@/constants/cryptoStatus";

const selectPendingWebhookEvents = async ({ limit, maxAttempts }: { limit: number; maxAttempts: number }) => {
    const eventRows = await db
        .selectFrom("provider_webhook_events")
        .select(["id"])
        .where("status", "in", [WEBHOOK_EVENT_STATUS.RECEIVED, WEBHOOK_EVENT_STATUS.FAILED])
        .where("attempts", "<", maxAttempts)
        .orderBy("receivedAt", "asc")
        .limit(limit)
        .execute();

    return eventRows;
};

export default selectPendingWebhookEvents;
