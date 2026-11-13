import { Request } from "express";
import rateLimit from "express-rate-limit";

// Looking up whose account a number is could be used to scrape names: cap it per user (after requireAuth).
const recipientLookupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    keyGenerator: (req: Request) => `recipient-lookup:${req.user?.id ?? "anonymous"}`,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many lookups, please try again in a few minutes", code: 429 },
});

export default recipientLookupLimiter;
