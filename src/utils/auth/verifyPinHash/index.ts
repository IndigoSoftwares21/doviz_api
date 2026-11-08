import bcrypt from "bcrypt";
import pepperPin from "@/utils/auth/pepperPin";

const verifyPinHash = async ({
    userId,
    pin,
    pinHash,
}: {
    userId: string;
    pin: string;
    pinHash: string;
}) => {
    const isMatch = await bcrypt.compare(pepperPin({ userId, pin }), pinHash);

    return isMatch;
};

export default verifyPinHash;
