import { z } from "zod";

const postProviderWebhookSchema = z.object({
    provider: z.string().regex(/^[a-z0-9_-]{2,32}$/, "Unknown provider"),
});

export default postProviderWebhookSchema;
