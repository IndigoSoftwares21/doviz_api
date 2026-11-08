import { randomInt } from "crypto";
import AUTH from "@/constants/auth";

// crypto.randomInt is a CSPRNG with no modulo bias — never use Math.random
// (or libraries built on it) for OTPs.
const generateOtp = ({ length = AUTH.OTP_LENGTH }: { length?: number } = {}) => {
    const otp = randomInt(0, 10 ** length)
        .toString()
        .padStart(length, "0");

    return otp;
};

export default generateOtp;
