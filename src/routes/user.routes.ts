import { Router } from "express";
import getUser from "@/controllers/user/get";
import putUserName from "@/controllers/userName/put";
import requireAuth from "@/middlewares/requireAuth";

const router = Router();

router.get("/", requireAuth, getUser);
router.put("/name", requireAuth, putUserName);

export default router;
