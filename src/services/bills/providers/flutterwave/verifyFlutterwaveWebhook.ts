import { timingSafeEqual } from "crypto";
import monitoring from "@/utils/monitoring";
import { WebhookRequest } from "@/services/crypto/cryptoProvider";

/**
 * Flutterwave v3 webhooks carry the secret hash we set in the dashboard, as-is,
 * in the `verif-hash` header (no signature). Constant-time compare. Authentic
 * or not, money only moves after re-fetching the payment from Flutterwave.
 */
const verifyFlutterwaveWebhook = ({ request }: { request: WebhookRequest }) => {
    const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    if (!expected) {
        monitoring.warn("FLUTTERWAVE_WEBHOOK_HASH is not set; rejecting Flutterwave webhook");
        return false;
    }

    const header = request.headers["verif-hash"];
    const received = Array.isArray(header) ? header[0] : header;
    if (typeof received !== "string") return false;

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
};

export default verifyFlutterwaveWebhook;
