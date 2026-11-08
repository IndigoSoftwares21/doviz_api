import { z } from "zod";
import phoneNumberSchema from "@/utils/validation/phoneNumberSchema";
import otpSchema from "@/utils/validation/otpSchema";
import deviceIdSchema from "@/utils/validation/deviceIdSchema";
import platformSchema from "@/utils/validation/platformSchema";

// Format checks only. The OTP itself is deliberately NOT checked here via a
// schemaHelper: verification must lock the OTP row and count the attempt in
// the same transaction (see createLogin), or parallel guesses could bypass
// the max-attempts lockout.
const postLoginSchema = z.object({
    phoneNumber: phoneNumberSchema,
    otp: otpSchema,
    deviceId: deviceIdSchema,
    deviceName: z
        .string()
        .trim()
        .max(100)
        .regex(/^[^\p{Cc}]*$/u, "Device name contains invalid characters")
        .optional(),
    platform: platformSchema.optional(),
});

export default postLoginSchema;
