import rateLimit from "express-rate-limit";

// Customer lookups are provider calls that reveal names on meters and
// smartcards — cap them per IP.
const billValidateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later", code: 429 },
});

export default billValidateLimiter;
