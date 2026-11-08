import rateLimit from "express-rate-limit";

// Per-IP cap on unlock attempts (normal use is one unlock per idle period),
// on top of the PIN lockout and single-use biometric challenges.
const sessionUnlockLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        message: "Too many requests, please try again later",
        code: 429,
    },
});

export default sessionUnlockLimiter;
