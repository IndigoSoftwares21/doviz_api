import { createHmac, timingSafeEqual } from "crypto";
import { WebhookRequest } from "@/services/crypto/cryptoProvider";
import { ProviderWebhookEvent } from "@/services/crypto/types";
import { WEBHOOK_RESOURCE_TYPE } from "@/constants/cryptoStatus";

const SIGNATURE_HEADER = "x-fossapay-signature";

/**
 * Fossapay signs ONLY `data`: HMAC-SHA256(webhook secret, JSON.stringify(body.data)),
 * lowercase hex, in `x-fossapay-signature`. Constant-time compare. Authentic or
 * not, money only moves after re-fetching the transaction.
 */
export const verifyFossapayWebhook = ({ request, secret }: { request: WebhookRequest; secret: string | null }) => {
    if (!secret) return false;
    const header = request.headers[SIGNATURE_HEADER];
    const received = Array.isArray(header) ? header[0] : header;
    const data = (request.body as { data?: unknown } | null)?.data;
    if (typeof received !== "string" || data === undefined) return false;
    const expected = Buffer.from(createHmac("sha256", secret).update(JSON.stringify(data)).digest("hex"));
    const given = Buffer.from(received.toLowerCase());
    return expected.length === given.length && timingSafeEqual(expected, given);
};

const PAYOUT_EVENTS = ["payout.completed", "payout.failed", "payout.reversed"];

/**
 * An NGN `deposit.completed` → an account deposit (by transaction id); a
 * `payout.*` → our withdrawal (by its reference = our withdrawal id); anything
 * else → acknowledged and ignored. Either way the record is re-fetched before money moves.
 */
export const parseFossapayWebhook = (body: unknown): ProviderWebhookEvent | null => {
    const envelope = (body ?? {}) as { eventId?: unknown; eventType?: unknown; timestamp?: unknown; data?: Record<string, unknown> };
    if (typeof envelope.eventId !== "string" || typeof envelope.eventType !== "string") return null;
    const data = envelope.data ?? {};
    const isNairaDeposit = envelope.eventType === "deposit.completed" && data.currency === "NGN" && typeof data.transactionId === "string";
    if (PAYOUT_EVENTS.includes(envelope.eventType) && typeof data.reference === "string") {
        return { eventId: envelope.eventId, eventName: envelope.eventType, resourceType: WEBHOOK_RESOURCE_TYPE.PAYOUT, resourceId: data.reference, eventTime: typeof envelope.timestamp === "string" ? new Date(envelope.timestamp) : null };
    }
    return {
        eventId: envelope.eventId,
        eventName: envelope.eventType,
        resourceType: isNairaDeposit ? WEBHOOK_RESOURCE_TYPE.ACCOUNT_DEPOSIT : WEBHOOK_RESOURCE_TYPE.OTHER,
        resourceId: isNairaDeposit ? (data.transactionId as string) : null,
        eventTime: typeof envelope.timestamp === "string" ? new Date(envelope.timestamp) : null,
    };
};
