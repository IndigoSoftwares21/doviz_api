import rateLimit from "express-rate-limit";

// Per-IP cap on OTP verification attempts, on top of the per-OTP
// max-attempts lockout enforced in createLogin.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        message: "Too many requests, please try again later",
        code: 429,
    },
});

export default loginLimiter;
