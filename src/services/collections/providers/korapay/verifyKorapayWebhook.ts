import { createHmac, timingSafeEqual } from "crypto";
import monitoring from "@/utils/monitoring";
import { WebhookRequest } from "@/services/crypto/cryptoProvider";
import KORAPAY from "./constants";

/**
 * Korapay signs ONLY the `data` object: HMAC-SHA256 of JSON.stringify(data)
 * with the secret key, hex, in `x-korapay-signature`. Constant-time compare.
 * Authentic or not, money only moves after re-fetching the charge.
 */
const verifyKorapayWebhook = ({ request, secretKey }: { request: WebhookRequest; secretKey: string }) => {
    if (!secretKey) {
        monitoring.warn("Korapay secret key is not set; rejecting Korapay webhook");
        return false;
    }

    const header = request.headers[KORAPAY.SIGNATURE_HEADER];
    const received = Array.isArray(header) ? header[0] : header;
    if (typeof received !== "string" || !request.body || typeof request.body !== "object") return false;

    const data = (request.body as { data?: unknown }).data;
    if (data === undefined) return false;

    const expected = createHmac("sha256", secretKey).update(JSON.stringify(data)).digest("hex");
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
};

export default verifyKorapayWebhook;
