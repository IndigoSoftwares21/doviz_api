import { z } from "zod";

// App-generated install ID (e.g. a UUID kept in the keychain/keystore).
const deviceIdSchema = z
    .string({ required_error: "Device ID is required" })
    .trim()
    .regex(/^[A-Za-z0-9_-]{8,128}$/, "Device ID must be 8-128 letters, digits, - or _");

export default deviceIdSchema;
