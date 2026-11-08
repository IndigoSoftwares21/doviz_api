import { createHmac, timingSafeEqual } from "crypto";

// HMAC both sides first so the comparison is constant-time and equal-length
// regardless of what was typed.
const verifyDocsPassword = ({
    candidate,
    password,
    secret,
}: {
    candidate: unknown;
    password: string;
    secret: string;
}) => {
    if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > 256) {
        return false;
    }

    const digest = (value: string) => createHmac("sha256", secret).update(value).digest();

    const isValid = timingSafeEqual(digest(candidate), digest(password));

    return isValid;
};

export default verifyDocsPassword;
