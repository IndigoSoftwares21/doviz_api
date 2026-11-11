import { Request } from "express";
import rateLimit from "express-rate-limit";

// Availability checks could be used to map out who's on Ziks — cap them per
// user (after requireAuth). Typing a tag debounces on the app, so 30 is plenty.
const tagCheckLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 30,
    keyGenerator: (req: Request) => `tag-check:${req.user?.id ?? "anonymous"}`,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many checks, please try again in a few minutes", code: 429 },
});

export default tagCheckLimiter;
