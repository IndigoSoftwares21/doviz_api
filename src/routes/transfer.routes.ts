import { Router } from "express";
import getTransferLimits from "@/controllers/transferLimits/get";
import getTransferRecipient from "@/controllers/transferRecipient/get";
import getRecentRecipients from "@/controllers/transferRecipients/get";
import postTransfer from "@/controllers/transfer/post";
import getTransfer from "@/controllers/transfer/get";
import transferRecipientLimiter from "@/middlewares/rateLimit/transferRecipientLimiter";
import requireAuth from "@/middlewares/requireAuth";

const router = Router();

// Ziks-to-Ziks transfers by Ziktag. Fixed paths before /:transferId so they
// aren't taken for an id; the lookup limiter counts per user (after requireAuth).
router.get("/limits", requireAuth, getTransferLimits);
router.get("/recipients/recent", requireAuth, getRecentRecipients);
router.get("/recipients", requireAuth, transferRecipientLimiter, getTransferRecipient);
router.post("/", requireAuth, postTransfer);
router.get("/:transferId", requireAuth, getTransfer);

export default router;
