import { Request } from "express";
import rateLimit from "express-rate-limit";

// Setting a Ziktag is a security event (and changing one needs the PIN):
// a handful of attempts per user per hour.
const tagUpdateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    keyGenerator: (req: Request) => `tag-update:${req.user?.id ?? "anonymous"}`,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many attempts, please try again later", code: 429 },
});

export default tagUpdateLimiter;
