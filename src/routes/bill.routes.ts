import { Router } from "express";
import getBillCategories from "@/controllers/billCategories/get";
import getBillers from "@/controllers/billers/get";
import getBillProducts from "@/controllers/billProducts/get";
import postBillCustomerValidation from "@/controllers/billCustomerValidation/post";
import postBillPayment from "@/controllers/billPayment/post";
import getBillPayment from "@/controllers/billPayment/get";
import getBillPayments from "@/controllers/billPayments/get";
import getBillNetwork from "@/controllers/billNetwork/get";
import requireAuth from "@/middlewares/requireAuth";
import billValidateLimiter from "@/middlewares/rateLimit/billValidateLimiter";

// Bill payments. Everything here is provider-neutral: Doviz ids and names only.
const router = Router();

router.get("/categories", requireAuth, getBillCategories);
router.get("/billers", requireAuth, getBillers);
router.get("/billers/:billerId/products", requireAuth, getBillProducts);
router.get("/networks/detect", requireAuth, getBillNetwork);
router.post("/validate", requireAuth, billValidateLimiter, postBillCustomerValidation);
router.post("/payments", requireAuth, postBillPayment);
router.get("/payments", requireAuth, getBillPayments);
router.get("/payments/:billPaymentId", requireAuth, getBillPayment);

export default router;
