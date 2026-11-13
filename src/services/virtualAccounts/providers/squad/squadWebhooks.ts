import { createHmac, timingSafeEqual } from "crypto";
import { WebhookRequest } from "@/services/crypto/cryptoProvider";
import { ProviderWebhookEvent } from "@/services/crypto/types";
import { WEBHOOK_RESOURCE_TYPE } from "@/constants/cryptoStatus";

const SIGNATURE_HEADER = "x-squad-signature";
/** Squad v2/v3: only these six fields, joined by "|", are signed. */
const V2_FIELDS = ["transaction_reference", "virtual_account_number", "currency", "principal_amount", "settled_amount", "customer_identifier"];

const matches = (expected: string, received: string) => {
    const a = Buffer.from(expected.toLowerCase());
    const b = Buffer.from(received.toLowerCase());
    return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Squad virtual-account webhooks: HMAC-SHA512 with our secret key in
 * `x-squad-signature` — over the whole body (v1) or the six fields joined by
 * "|" (v2/v3). Hex case differs between Squad's own samples, so it's ignored.
 * Authentic or not, money only moves after re-fetching the transaction.
 */
export const verifySquadWebhook = ({ request, secretKey }: { request: WebhookRequest; secretKey: string }) => {
    const header = request.headers[SIGNATURE_HEADER];
    const received = Array.isArray(header) ? header[0] : header;
    const body = request.body as Record<string, unknown> | null;
    if (typeof received !== "string" || !body || typeof body !== "object") return false;
    const hmac = (text: string) => createHmac("sha512", secretKey).update(text).digest("hex");
    return matches(hmac(JSON.stringify(body)), received) || matches(hmac(V2_FIELDS.map((field) => String(body[field] ?? "")).join("|")), received);
};

/** A credit to a virtual account → an account deposit (by Squad's transaction reference); anything else → ignored. */
export const parseSquadWebhook = (body: unknown): ProviderWebhookEvent | null => {
    const data = (body ?? {}) as Record<string, unknown>;
    if (typeof data.transaction_reference !== "string") return null;
    const isCredit = String(data.transaction_indicator ?? "C").toUpperCase() === "C" && typeof data.virtual_account_number === "string";
    return {
        eventId: `squad:${data.transaction_reference}`,
        eventName: "virtual-account.credit",
        resourceType: isCredit ? WEBHOOK_RESOURCE_TYPE.ACCOUNT_DEPOSIT : WEBHOOK_RESOURCE_TYPE.OTHER,
        resourceId: isCredit ? data.transaction_reference : null,
        eventTime: typeof data.transaction_date === "string" ? new Date(data.transaction_date) : null,
    };
};
