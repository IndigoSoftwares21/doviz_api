import { ProviderWebhookEvent } from "@/services/crypto/types";
import { WEBHOOK_RESOURCE_TYPE } from "@/constants/cryptoStatus";

const BILL_EVENT = "singlebillpayment.status";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * Flutterwave webhook body → neutral event. Null for anything malformed.
 * Bill events have no id of their own, so the event id is "<ref>:<status>"
 * (a redelivery of the same status dedupes; a new status is a new event).
 * resourceId is our own reference when Flutterwave echoes it back, else its tx_ref.
 */
const parseFlutterwaveWebhook = ({ body }: { body: unknown }): ProviderWebhookEvent | null => {
    if (!body || typeof body !== "object") return null;
    const { event, data } = body as { event?: unknown; data?: Record<string, unknown> };
    const eventName = text(event);
    if (!eventName || !data || typeof data !== "object") return null;

    const references = [data.customer_reference, data.reference, data.tx_ref, data.flw_ref].map(text).filter((value): value is string => value !== null);
    const resourceId = references.find((value) => UUID.test(value)) ?? text(data.tx_ref) ?? text(data.flw_ref);
    const status = text(data.status) ?? "unknown";
    const eventKey = text(data.tx_ref) ?? resourceId;
    if (!eventKey) return null;

    return {
        eventId: `${eventKey}:${status}`.slice(0, 128),
        eventName: eventName.slice(0, 64),
        resourceType: eventName === BILL_EVENT ? WEBHOOK_RESOURCE_TYPE.BILL_PAYMENT : WEBHOOK_RESOURCE_TYPE.OTHER,
        resourceId: resourceId ? resourceId.slice(0, 64) : null,
        eventTime: null,
    };
};

export default parseFlutterwaveWebhook;
