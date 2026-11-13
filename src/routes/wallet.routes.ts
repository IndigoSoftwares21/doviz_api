import getWithdrawalOptions from "@/controllers/withdrawalOptions/get";
import getWithdrawalRecipient from "@/controllers/withdrawalRecipient/get";
import recipientLookupLimiter from "@/middlewares/rateLimit/recipientLookupLimiter";
import { Router } from "express";
import getWalletBalance from "@/controllers/walletBalance/get";
import getWalletTransactions from "@/controllers/walletTransactions/get";
import getWalletTransaction from "@/controllers/walletTransaction/get";
import getWalletIncoming from "@/controllers/walletIncoming/get";
import getWithdrawalQuote from "@/controllers/withdrawalQuote/get";
import postWithdrawal from "@/controllers/withdrawal/post";
import getWithdrawal from "@/controllers/withdrawal/get";
import requireAuth from "@/middlewares/requireAuth";

const router = Router();

router.get("/balance", requireAuth, getWalletBalance);
router.get("/transactions", requireAuth, getWalletTransactions);
router.get("/transactions/:id", requireAuth, getWalletTransaction);
router.get("/incoming", requireAuth, getWalletIncoming);
// Withdrawals to the user's own bank. /quote before /:withdrawalId so it isn't taken for an id.
router.get("/withdrawals/options", requireAuth, getWithdrawalOptions);
router.get("/withdrawals/recipient", requireAuth, recipientLookupLimiter, getWithdrawalRecipient);
router.get("/withdrawals/quote", requireAuth, getWithdrawalQuote);
router.post("/withdrawals", requireAuth, postWithdrawal);
router.get("/withdrawals/:withdrawalId", requireAuth, getWithdrawal);

export default router;
