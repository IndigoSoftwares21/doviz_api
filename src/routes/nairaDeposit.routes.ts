import { Router } from "express";
import postNairaDeposit from "@/controllers/nairaDeposit/post";
import getNairaDeposit from "@/controllers/nairaDeposit/get";
import getNairaDeposits from "@/controllers/nairaDeposits/get";
import getActiveNairaDeposit from "@/controllers/activeNairaDeposit/get";
import postNairaDepositCancellation from "@/controllers/nairaDepositCancellation/post";
import getNairaFundingOptions from "@/controllers/nairaFundingOptions/get";
import requireAuth from "@/middlewares/requireAuth";

// Naira top-ups by bank transfer. Provider-neutral: Doviz ids and account details only.
const router = Router();

router.post("/", requireAuth, postNairaDeposit);
router.get("/", requireAuth, getNairaDeposits);
// Before /:nairaDepositId so "options" / "active" aren't read as ids.
router.get("/options", requireAuth, getNairaFundingOptions);
router.get("/active", requireAuth, getActiveNairaDeposit);
router.get("/:nairaDepositId", requireAuth, getNairaDeposit);
// Stop offering this top-up's account. Money already sent to it is still credited.
router.post("/:nairaDepositId/cancel", requireAuth, postNairaDepositCancellation);

export default router;
