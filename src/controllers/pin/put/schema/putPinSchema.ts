import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import newPinSchema from "@/utils/validation/newPinSchema";

// The current PIN is checked in modifyPin (with attempt counting), not here.
const putPinSchema = z
    .object({
        currentPin: pinSchema,
        newPin: newPinSchema,
        confirmPin: z.string({ required_error: "Confirm your new PIN" }),
    })
    .superRefine((values, ctx) => {
        if (values.newPin !== values.confirmPin) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPin"], message: "PINs don't match" });
        }

        if (values.newPin === values.currentPin) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["newPin"],
                message: "New PIN must be different from your current PIN",
            });
        }
    });

export default putPinSchema;
