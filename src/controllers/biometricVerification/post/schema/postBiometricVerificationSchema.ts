import { z } from "zod";

// The signature itself is checked in createBiometricVerification, which
// also burns the challenge so it can't be retried.
const postBiometricVerificationSchema = z.object({
    challengeId: z.string({ required_error: "Challenge ID is required" }).uuid("Invalid challenge ID"),
    signature: z
        .string({ required_error: "Signature is required" })
        .trim()
        .regex(/^[A-Za-z0-9+/_-]+={0,2}$/, "Signature must be base64")
        .max(200),
});

export default postBiometricVerificationSchema;
