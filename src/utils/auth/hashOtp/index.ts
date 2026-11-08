import { createHmac } from "crypto";
import getRequiredEnv from "@/utils/auth/getRequiredEnv";

// Keyed hash so a DB leak alone can't brute-force the 10^6 code space —
// the attacker would also need OTP_PEPPER. `subject` binds the code to what
// it verifies (a phone number, or `email:{userId}:{email}`), so a hash from
// one row is never valid for another.
const hashOtp = ({ subject, otp }: { subject: string; otp: string }) => {
    const otpHash = createHmac("sha256", getRequiredEnv({ name: "OTP_PEPPER" }))
        .update(`${subject}:${otp}`)
        .digest("hex");

    return otpHash;
};

export default hashOtp;
