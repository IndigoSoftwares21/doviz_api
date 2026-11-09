import { Router } from "express";
import getWalletBalance from "@/controllers/walletBalance/get";
import getWalletTransactions from "@/controllers/walletTransactions/get";
import getWalletTransaction from "@/controllers/walletTransaction/get";
import getWalletIncoming from "@/controllers/walletIncoming/get";
import requireAuth from "@/middlewares/requireAuth";

const router = Router();

router.get("/balance", requireAuth, getWalletBalance);
router.get("/transactions", requireAuth, getWalletTransactions);
router.get("/transactions/:id", requireAuth, getWalletTransaction);
router.get("/incoming", requireAuth, getWalletIncoming);

export default router;
