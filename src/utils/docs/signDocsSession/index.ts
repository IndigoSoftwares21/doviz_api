import { createHash, createHmac } from "crypto";

// `{expiresAt}.{hmac}`. The password's hash is part of the signed payload,
// so changing DOCS_PASSWORD signs everyone out.
const signDocsSession = ({
    secret,
    password,
    expiresAt,
}: {
    secret: string;
    password: string;
    expiresAt: number;
}) => {
    const passwordFingerprint = createHash("sha256").update(password).digest("hex");
    const signature = createHmac("sha256", secret)
        .update(`doviz-docs:${expiresAt}:${passwordFingerprint}`)
        .digest("hex");
    const sessionToken = `${expiresAt}.${signature}`;

    return sessionToken;
};

export default signDocsSession;
