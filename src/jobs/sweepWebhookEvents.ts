import fetchPendingWebhookEvents from "@/actions/providerWebhookEvent/fetchPendingWebhookEvents";
import processWebhookEvent from "@/actions/providerWebhookEvent/processWebhookEvent";

/** Safety net for webhooks: processes anything stored but not yet handled. */
const sweepWebhookEvents = async () => {
    const { data: events } = await fetchPendingWebhookEvents({ limit: 50, maxAttempts: 10 });

    for (const event of events) {
        await processWebhookEvent({ id: event.id });
    }
};

export default sweepWebhookEvents;
