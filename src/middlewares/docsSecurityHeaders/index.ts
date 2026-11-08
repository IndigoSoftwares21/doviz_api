import { randomBytes } from "crypto";
import { NextFunction, Request, Response } from "express";

// Replaces the app-wide `default-src 'self'` CSP for /docs only. Scripts run
// only with this request's nonce; connect-src 'self' keeps "Try it" requests
// (and their bearer tokens) on our origin — never via a third-party proxy.
const docsSecurityHeaders = (_req: Request, res: Response, next: NextFunction) => {
    const nonce = randomBytes(16).toString("base64");
    res.locals.cspNonce = nonce;

    res.setHeader(
        "Content-Security-Policy",
        [
            "default-src 'none'",
            `script-src 'nonce-${nonce}'`,
            "style-src 'self' 'unsafe-inline'",
            "font-src https://fonts.scalar.com",
            "img-src 'self' data: blob:",
            "connect-src 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "base-uri 'none'",
        ].join("; "),
    );
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");

    next();
};

export default docsSecurityHeaders;
