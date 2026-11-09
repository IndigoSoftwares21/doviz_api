import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import monitoring from "@/utils/monitoring";
import providerRegistry from "@/services/crypto/providerRegistry";
import createProviderWebhookEvent from "@/actions/providerWebhookEvent/createProviderWebhookEvent";
import createProviderWebhookRejection from "@/actions/providerWebhookRejection/createProviderWebhookRejection";
import processWebhookEvent from "@/actions/providerWebhookEvent/processWebhookEvent";
import postProviderWebhookSchema from "./schema/postProviderWebhookSchema";

/**
 * Inbound provider webhook: verify → store (deduped) → 200 at once → process
 * in the background. Bodies and headers are never logged; nothing from an
 * unverified request is stored.
 */
const postProviderWebhook = async (req: Request, res: Response) => {
    try {
        const parsed = postProviderWebhookSchema.safeParse({ provider: req.params.provider });
        if (!parsed.success || !providerRegistry.has({ name: parsed.data.provider })) {
            return handleError({ res, req, message: "Not found", code: 404 });
        }
        const name = parsed.data.provider;
        const provider = providerRegistry.get({ name });
        const sourceIp = req.ip ?? null;

        if (!provider.verifyWebhook({ headers: req.headers, body: req.body, sourceIp })) {
            await createProviderWebhookRejection({ provider: name, ipAddress: sourceIp });
            return handleError({ res, req, message: "Unauthorized", code: 401 });
        }

        // Checked only AFTER verifyWebhook: an unauthenticated ping is still a 401.
        if (provider.isWebhookPing(req.body)) {
            return handleSuccess({ res, req, message: "Webhook verified", code: 200, data: { received: true } });
        }

        const event = provider.parseWebhook(req.body);
        if (!event) {
            return handleError({ res, req, message: "Unrecognised webhook", code: 400 });
        }

        const { data } = await createProviderWebhookEvent({ provider: name, event, payload: req.body, sourceIp });

        if (data.isNew && data.id) {
            const id = data.id;
            setImmediate(() => {
                processWebhookEvent({ id }).catch((error) => monitoring.error(`Webhook event ${id} processing failed`, error));
            });
        }

        return handleSuccess({ res, req, message: "Webhook received", code: 200, data: { received: true } });
    } catch (error) {
        return handleError({ res, req, message: "Failed to receive webhook", error });
    }
};

export default postProviderWebhook;
