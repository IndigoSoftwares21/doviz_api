import { ProviderWebhookEvent } from "@/services/crypto/types";
import { WEBHOOK_RESOURCE_TYPE } from "@/constants/cryptoStatus";
import KORAPAY from "./constants";

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * Korapay webhook body → neutral event. Null for anything malformed.
 * `data.reference` is OUR reference (the deposit id we sent). Events have no
 * id of their own, so the event id is "<reference>:<event>": a redelivery
 * dedupes, a new outcome is a new event.
 */
const parseKorapayWebhook = ({ body }: { body: unknown }): ProviderWebhookEvent | null => {
    if (!body || typeof body !== "object") return null;
    const { event, data } = body as { event?: unknown; data?: Record<string, unknown> };
    const eventName = text(event);
    if (!eventName || !data || typeof data !== "object") return null;

    const reference = text(data.reference) ?? text(data.payment_reference);
    if (!reference) return null;

    return {
        eventId: `${reference}:${eventName}`.slice(0, 128),
        eventName: eventName.slice(0, 64),
        resourceType: eventName.startsWith(KORAPAY.CHARGE_EVENT_PREFIX) ? WEBHOOK_RESOURCE_TYPE.NAIRA_DEPOSIT : WEBHOOK_RESOURCE_TYPE.OTHER,
        resourceId: reference.slice(0, 64),
        eventTime: null,
    };
};

export default parseKorapayWebhook;
