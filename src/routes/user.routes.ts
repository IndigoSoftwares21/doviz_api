import { Router } from "express";
import getUser from "@/controllers/user/get";
import putUserName from "@/controllers/userName/put";
import getTagCheck from "@/controllers/userTagCheck/get";
import getTagSuggestions from "@/controllers/userTagSuggestions/get";
import putUserTag from "@/controllers/userTag/put";
import tagCheckLimiter from "@/middlewares/rateLimit/tagCheckLimiter";
import tagUpdateLimiter from "@/middlewares/rateLimit/tagUpdateLimiter";
import requireAuth from "@/middlewares/requireAuth";

const router = Router();

router.get("/", requireAuth, getUser);
router.put("/name", requireAuth, putUserName);
// Ziktags (@handles). Limits run after requireAuth: they count per user.
router.get("/tag/check", requireAuth, tagCheckLimiter, getTagCheck);
router.get("/tag/suggestions", requireAuth, getTagSuggestions);
router.put("/tag", requireAuth, tagUpdateLimiter, putUserTag);

export default router;
