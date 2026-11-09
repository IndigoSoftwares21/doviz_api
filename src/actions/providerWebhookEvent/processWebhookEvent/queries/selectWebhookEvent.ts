import { db } from "@/database";

const selectWebhookEvent = async ({ id }: { id: string }) => {
    const eventRow = await db
        .selectFrom("provider_webhook_events")
        .select(["id", "provider", "payload", "status", "attempts"])
        .where("id", "=", id)
        .executeTakeFirst();

    return eventRow;
};

export default selectWebhookEvent;
