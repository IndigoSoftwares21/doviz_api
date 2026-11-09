import { ProviderWebhookEvent } from "@/services/crypto/types";
import insertProviderWebhookEvent from "./queries/insertProviderWebhookEvent";

interface ICreateProviderWebhookEvent {
    provider: string;
    event: ProviderWebhookEvent;
    payload: unknown;
    sourceIp: string | null;
}

/** Stores the event before any processing. `isNew` is false for redeliveries. */
const createProviderWebhookEvent = async ({ provider, event, payload, sourceIp }: ICreateProviderWebhookEvent) => {
    const eventRow = await insertProviderWebhookEvent({ provider, event, payload, sourceIp });

    const data = { id: eventRow?.id ?? null, isNew: !!eventRow };

    return { data };
};

export default createProviderWebhookEvent;
