import { createHmac } from "crypto";
import getRequiredEnv from "@/utils/auth/getRequiredEnv";

// A 4-digit PIN has only 10^4 values, so bcrypt alone can't stop an offline
// brute force after a DB leak. Peppering with a server-side secret first
// means the DB alone is useless; binding userId stops hash reuse across users.
const pepperPin = ({ userId, pin }: { userId: string; pin: string }) => {
    const pepperedPin = createHmac("sha256", getRequiredEnv({ name: "PIN_PEPPER" }))
        .update(`${userId}:${pin}`)
        .digest("hex");

    return pepperedPin;
};

export default pepperPin;
