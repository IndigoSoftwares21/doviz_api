import rateLimit from "express-rate-limit";

// Bank-name lookups are paid provider calls and can be used to probe
// account names — cap them per IP.
const bankResolveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later", code: 429 },
});

export default bankResolveLimiter;
