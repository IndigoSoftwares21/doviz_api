import { Request } from "express";
import rateLimit from "express-rate-limit";

// Looking people up by Ziktag could be used to scrape who's on Ziks — cap it
// per user (after requireAuth). The app debounces typing, so 30 is plenty.
const transferRecipientLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 30,
    keyGenerator: (req: Request) => `transfer-recipient:${req.user?.id ?? "anonymous"}`,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many lookups, please try again in a few minutes", code: 429 },
});

export default transferRecipientLimiter;
