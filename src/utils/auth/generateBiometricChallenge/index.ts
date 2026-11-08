import { randomBytes } from "crypto";

const generateBiometricChallenge = () => {
    const challenge = randomBytes(32).toString("base64url");

    return challenge;
};

export default generateBiometricChallenge;
