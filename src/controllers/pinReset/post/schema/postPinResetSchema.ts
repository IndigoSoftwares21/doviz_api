import { z } from "zod";
import otpSchema from "@/utils/validation/otpSchema";
import newPinSchema from "@/utils/validation/newPinSchema";

// The SMS code is checked atomically in createPinReset (row lock + attempt
// counting), for the same reason as postLoginSchema.
const postPinResetSchema = z
    .object({
        otp: otpSchema,
        newPin: newPinSchema,
        confirmPin: z.string({ required_error: "Confirm your new PIN" }),
    })
    .superRefine((values, ctx) => {
        if (values.newPin !== values.confirmPin) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPin"], message: "PINs don't match" });
        }
    });

export default postPinResetSchema;
