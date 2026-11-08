import rateLimit from "express-rate-limit";
import renderDocsLoginPage from "@/docs/renderDocsLoginPage";

// Only failed attempts count: 5 wrong passwords per IP per 15 minutes.
const docsLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => {
        res.status(429).send(
            renderDocsLoginPage({
                nonce: res.locals.cspNonce,
                error: "Too many attempts. Try again in 15 minutes.",
            }),
        );
    },
});

export default docsLoginLimiter;
