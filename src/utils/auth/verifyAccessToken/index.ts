import jwt from "jsonwebtoken";
import AUTH from "@/constants/auth";
import getRequiredEnv from "@/utils/auth/getRequiredEnv";

// Throws on a bad signature, wrong alg/issuer/audience, expiry, or missing
// claims. Algorithm is pinned to block alg-confusion attacks.
const verifyAccessToken = ({ token }: { token: string }) => {
    const claims = jwt.verify(token, getRequiredEnv({ name: "JWT_ACCESS_SECRET" }), {
        algorithms: ["HS256"],
        issuer: AUTH.JWT_ISSUER,
        audience: AUTH.JWT_AUDIENCE,
    });

    if (
        typeof claims === "string" ||
        typeof claims.sub !== "string" ||
        typeof claims.sid !== "string"
    ) {
        throw new Error("Malformed access token");
    }

    return { userId: claims.sub, sessionId: claims.sid };
};

export default verifyAccessToken;
