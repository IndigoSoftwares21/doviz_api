import { Router } from "express";
import getBanks from "@/controllers/banks/get";
import postBankResolution from "@/controllers/bankResolution/post";
import requireAuth from "@/middlewares/requireAuth";
import bankResolveLimiter from "@/middlewares/rateLimit/bankResolveLimiter";

const router = Router();

router.get("/", requireAuth, getBanks);
router.post("/resolve", requireAuth, bankResolveLimiter, postBankResolution);

export default router;
