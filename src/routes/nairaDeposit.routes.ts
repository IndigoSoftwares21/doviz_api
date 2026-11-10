import { Router } from "express";
import postNairaDeposit from "@/controllers/nairaDeposit/post";
import getNairaDeposit from "@/controllers/nairaDeposit/get";
import getNairaDeposits from "@/controllers/nairaDeposits/get";
import requireAuth from "@/middlewares/requireAuth";

// Naira top-ups by bank transfer. Provider-neutral: Doviz ids and account details only.
const router = Router();

router.post("/", requireAuth, postNairaDeposit);
router.get("/", requireAuth, getNairaDeposits);
router.get("/:nairaDepositId", requireAuth, getNairaDeposit);

export default router;
