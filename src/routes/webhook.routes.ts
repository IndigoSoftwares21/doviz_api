import { Router } from "express";
import postProviderWebhook from "@/controllers/providerWebhook/post";

// Provider → Doviz callbacks. No user auth: each provider verifies its own
// requests (providerRegistry → verifyWebhook), and nothing is trusted until
// the provider's own record is re-fetched.
const router = Router();

router.post("/:provider", postProviderWebhook);

export default router;
