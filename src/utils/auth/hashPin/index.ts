import bcrypt from "bcrypt";
import AUTH from "@/constants/auth";
import pepperPin from "@/utils/auth/pepperPin";

const hashPin = async ({ userId, pin }: { userId: string; pin: string }) => {
    const pinHash = await bcrypt.hash(pepperPin({ userId, pin }), AUTH.PIN_BCRYPT_ROUNDS);

    return pinHash;
};

export default hashPin;
