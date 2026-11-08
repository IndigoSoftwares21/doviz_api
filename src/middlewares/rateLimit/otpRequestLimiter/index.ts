import rateLimit from "express-rate-limit";

// Per-IP cap on OTP sends — guards against SMS-pumping fraud. Per-phone
// cooldown/hourly limits are enforced separately in postOtpSchema.
const otpRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        message: "Too many requests, please try again later",
        code: 429,
    },
});

export default otpRequestLimiter;
