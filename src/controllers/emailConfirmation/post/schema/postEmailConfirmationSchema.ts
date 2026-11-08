import { z } from "zod";
import otpSchema from "@/utils/validation/otpSchema";

// Format only — the code is checked atomically in createEmailConfirmation
// (row lock + attempt counting), for the same reason as postLoginSchema.
const postEmailConfirmationSchema = z.object({
    otp: otpSchema,
});

export default postEmailConfirmationSchema;
