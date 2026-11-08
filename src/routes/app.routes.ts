import { Router } from "express";
import getDemo from "@/controllers/demo/get";
import postDemo from "@/controllers/demo/post";
import authRoutes from "@/routes/auth.routes";
import userRoutes from "@/routes/user.routes";

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
router.use("/user", userRoutes);

export default router;
