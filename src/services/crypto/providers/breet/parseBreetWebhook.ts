import { ProviderWebhookEvent } from "../../types";
import BREET from "./constants";
import { WEBHOOK_RESOURCE_TYPE } from "@/constants/cryptoStatus";

/** Breet webhook body → neutral event. Null for anything malformed. */
const parseBreetWebhook = ({ body }: { body: unknown }): ProviderWebhookEvent | null => {
    if (!body || typeof body !== "object") return null;
    const payload = body as Record<string, unknown>;
    const { event, eventId, id, eventTime } = payload;
    if (typeof event !== "string" || typeof eventId !== "string" || !event || !eventId) return null;

    const resourceType: ProviderWebhookEvent["resourceType"] = (BREET.DEPOSIT_EVENTS as readonly string[]).includes(event)
        ? WEBHOOK_RESOURCE_TYPE.DEPOSIT
        : event.startsWith("withdrawal.")
          ? WEBHOOK_RESOURCE_TYPE.PAYOUT
          : WEBHOOK_RESOURCE_TYPE.OTHER;

    const time = typeof eventTime === "string" ? new Date(eventTime) : null;

    return {
        eventId,
        eventName: event,
        resourceType,
        resourceId: typeof id === "string" && id ? id : null,
        eventTime: time && !Number.isNaN(time.getTime()) ? time : null,
    };
};

export default parseBreetWebhook;
