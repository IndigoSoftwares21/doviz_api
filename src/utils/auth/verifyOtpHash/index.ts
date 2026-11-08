import { timingSafeEqual } from "crypto";
import hashOtp from "@/utils/auth/hashOtp";

const verifyOtpHash = ({
    subject,
    otp,
    codeHash,
}: {
    subject: string;
    otp: string;
    codeHash: string;
}) => {
    const candidate = Buffer.from(hashOtp({ subject, otp }), "hex");
    const stored = Buffer.from(codeHash, "hex");

    if (candidate.length !== stored.length) {
        return false;
    }

    const isMatch = timingSafeEqual(candidate, stored);

    return isMatch;
};

export default verifyOtpHash;
