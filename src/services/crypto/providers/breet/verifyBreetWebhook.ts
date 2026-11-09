import { timingSafeEqual } from "crypto";
import monitoring from "@/utils/monitoring";
import { WebhookRequest } from "../../cryptoProvider";
import BREET from "./constants";

/**
 * Breet webhooks are not signed — only a shared secret in x-webhook-secret.
 * Constant-time compare, plus (when enforced) Breet's published source IPs.
 * Authentic or not, money only moves after re-fetching the record from Breet.
 */
const verifyBreetWebhook = ({ request }: { request: WebhookRequest }) => {
    const expected = process.env.BREET_WEBHOOK_SECRET;
    if (!expected) {
        monitoring.warn("BREET_WEBHOOK_SECRET is not set; rejecting Breet webhook");
        return false;
    }

    const header = request.headers["x-webhook-secret"];
    const received = Array.isArray(header) ? header[0] : header;
    if (typeof received !== "string") return false;

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    if (expectedBuffer.length !== receivedBuffer.length) return false;
    if (!timingSafeEqual(expectedBuffer, receivedBuffer)) return false;

    if (process.env.BREET_ENFORCE_WEBHOOK_IP === "true") {
        const ip = (request.sourceIp ?? "").replace(/^::ffff:/, "");
        if (!(BREET.WEBHOOK_IPS as readonly string[]).includes(ip)) return false;
    }

    return true;
};

export default verifyBreetWebhook;
