import selectPendingWebhookEvents from "./queries/selectPendingWebhookEvents";

/** Events not yet processed (new, or failed and under the retry cap), oldest first. */
const fetchPendingWebhookEvents = async ({ limit = 50, maxAttempts = 10 }: { limit?: number; maxAttempts?: number } = {}) => {
    const data = await selectPendingWebhookEvents({ limit, maxAttempts });

    return { data };
};

export default fetchPendingWebhookEvents;
