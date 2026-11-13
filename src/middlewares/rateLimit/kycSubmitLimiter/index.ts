import { Request } from "express";
import rateLimit from "express-rate-limit";

// Submitting KYC could be used to test whose BVN is on Ziks — cap it per
// user (after requireAuth), on top of the PIN it already needs.
const kycSubmitLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    keyGenerator: (req: Request) => `kyc-submit:${req.user?.id ?? "anonymous"}`,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many attempts, please try again in an hour", code: 429 },
});

export default kycSubmitLimiter;
