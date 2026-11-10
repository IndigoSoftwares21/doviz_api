import { Router } from "express";
import getDemo from "@/controllers/demo/get";
import postDemo from "@/controllers/demo/post";
import authRoutes from "@/routes/auth.routes";
import userRoutes from "@/routes/user.routes";
import cryptoRoutes from "@/routes/crypto.routes";
import walletRoutes from "@/routes/wallet.routes";
import bankRoutes from "@/routes/bank.routes";
import bankAccountRoutes from "@/routes/bankAccount.routes";
import billRoutes from "@/routes/bill.routes";
import nairaDepositRoutes from "@/routes/nairaDeposit.routes";

const router = Router();

router.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

// Reference implementation of the controller -> action -> query pattern —
// see AGENTS.md for the full convention this follows.
router.get("/demo", getDemo);
router.post("/demo", postDemo);

// Add your app routes here
router.use("/auth", authRoutes);
// More specific /user path first so it isn't swallowed by /user.
router.use("/user/bank-accounts", bankAccountRoutes);
router.use("/user", userRoutes);
router.use("/crypto", cryptoRoutes);
router.use("/wallet", walletRoutes);
router.use("/banks", bankRoutes);
router.use("/bills", billRoutes);
router.use("/naira-deposits", nairaDepositRoutes);

export default router;
