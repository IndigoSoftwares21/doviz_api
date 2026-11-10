import { Router } from "express";
import getBillCategories from "@/controllers/billCategories/get";
import getBillers from "@/controllers/billers/get";
import getBillProducts from "@/controllers/billProducts/get";
import postBillCustomerValidation from "@/controllers/billCustomerValidation/post";
import requireAuth from "@/middlewares/requireAuth";
import billValidateLimiter from "@/middlewares/rateLimit/billValidateLimiter";

// Bill payments. Everything here is provider-neutral: Doviz ids and names only.
const router = Router();

router.get("/categories", requireAuth, getBillCategories);
router.get("/billers", requireAuth, getBillers);
router.get("/billers/:billerId/products", requireAuth, getBillProducts);
router.post("/validate", requireAuth, billValidateLimiter, postBillCustomerValidation);

export default router;
