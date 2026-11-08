import { timingSafeEqual } from "crypto";
import signDocsSession from "@/utils/docs/signDocsSession";

const verifyDocsSession = ({
    token,
    secret,
    password,
}: {
    token: string | undefined;
    secret: string;
    password: string;
}) => {
    if (!token || !/^\d{13}\.[0-9a-f]{64}$/.test(token)) {
        return false;
    }

    const expiresAt = Number(token.split(".")[0]);

    if (expiresAt <= Date.now()) {
        return false;
    }

    const expected = Buffer.from(signDocsSession({ secret, password, expiresAt }));
    const received = Buffer.from(token);

    const isValid = expected.length === received.length && timingSafeEqual(expected, received);

    return isValid;
};

export default verifyDocsSession;
