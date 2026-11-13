import { Router } from "express";
import getUser from "@/controllers/user/get";
import putUserName from "@/controllers/userName/put";
import getTagCheck from "@/controllers/userTagCheck/get";
import getTagSuggestions from "@/controllers/userTagSuggestions/get";
import putUserTag from "@/controllers/userTag/put";
import tagCheckLimiter from "@/middlewares/rateLimit/tagCheckLimiter";
import tagUpdateLimiter from "@/middlewares/rateLimit/tagUpdateLimiter";
import getUserKyc from "@/controllers/userKyc/get";
import postUserKyc from "@/controllers/userKyc/post";
import kycSubmitLimiter from "@/middlewares/rateLimit/kycSubmitLimiter";
import getUserVirtualAccount from "@/controllers/userVirtualAccount/get";
import postUserVirtualAccount from "@/controllers/userVirtualAccount/post";
import virtualAccountLimiter from "@/middlewares/rateLimit/virtualAccountLimiter";
import requireAuth from "@/middlewares/requireAuth";

const router = Router();

router.get("/", requireAuth, getUser);
router.put("/name", requireAuth, putUserName);
// Ziktags (@handles). Limits run after requireAuth: they count per user.
router.get("/tag/check", requireAuth, tagCheckLimiter, getTagCheck);
router.get("/tag/suggestions", requireAuth, getTagSuggestions);
router.put("/tag", requireAuth, tagUpdateLimiter, putUserTag);
// Identity verification (BVN). Submitting is limited per user and needs the PIN.
router.get("/kyc", requireAuth, getUserKyc);
router.post("/kyc", requireAuth, kycSubmitLimiter, postUserKyc);
// The personal account number (created automatically once verified; POST retries).
router.get("/virtual-account", requireAuth, getUserVirtualAccount);
router.post("/virtual-account", requireAuth, virtualAccountLimiter, postUserVirtualAccount);

export default router;
