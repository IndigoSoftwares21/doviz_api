import { Request } from "express";
import rateLimit from "express-rate-limit";

// Each attempt may call the provider: cap retries per user (after requireAuth).
const virtualAccountLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    keyGenerator: (req: Request) => `virtual-account:${req.user?.id ?? "anonymous"}`,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many attempts, please try again in an hour", code: 429 },
});

export default virtualAccountLimiter;
