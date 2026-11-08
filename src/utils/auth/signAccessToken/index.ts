import jwt from "jsonwebtoken";
import AUTH from "@/constants/auth";
import getRequiredEnv from "@/utils/auth/getRequiredEnv";

const signAccessToken = ({
    userId,
    sessionId,
}: {
    userId: string;
    sessionId: string;
}) => {
    const accessToken = jwt.sign(
        { sid: sessionId },
        getRequiredEnv({ name: "JWT_ACCESS_SECRET" }),
        {
            algorithm: "HS256",
            subject: userId,
            issuer: AUTH.JWT_ISSUER,
            audience: AUTH.JWT_AUDIENCE,
            expiresIn: AUTH.ACCESS_TOKEN_TTL_SECONDS,
        },
    );

    return accessToken;
};

export default signAccessToken;
