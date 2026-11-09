import { sql } from "kysely";
import { db } from "@/database";

const updateWebhookEventAttempt = async ({ id }: { id: string }) => {
    const eventRow = await db
        .updateTable("provider_webhook_events")
        .set({ attempts: sql<number>`attempts + 1` })
        .where("id", "=", id)
        .returning(["id", "attempts"])
        .executeTakeFirstOrThrow();

    return eventRow;
};

export default updateWebhookEventAttempt;
