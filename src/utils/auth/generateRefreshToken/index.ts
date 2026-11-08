import { randomBytes } from "crypto";

const generateRefreshToken = () => {
    const refreshToken = randomBytes(32).toString("base64url");

    return refreshToken;
};

export default generateRefreshToken;
