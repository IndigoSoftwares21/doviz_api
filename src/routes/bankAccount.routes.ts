import { Router } from "express";
import getBankAccounts from "@/controllers/bankAccounts/get";
import postBankAccount from "@/controllers/bankAccount/post";
import requireAuth from "@/middlewares/requireAuth";
import bankResolveLimiter from "@/middlewares/rateLimit/bankResolveLimiter";

const router = Router();

router.get("/", requireAuth, getBankAccounts);
router.post("/", requireAuth, bankResolveLimiter, postBankAccount);

export default router;
