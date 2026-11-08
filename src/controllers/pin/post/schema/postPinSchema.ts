import { z } from "zod";
import newPinSchema from "@/utils/validation/newPinSchema";
import selectTransactionPinByUser from "@/schemaHelpers/selectTransactionPinByUser";

// userId comes from requireAuth and is not re-validated here.
const postPinSchema = z
    .object({
        userId: z.string(),
        pin: newPinSchema,
        confirmPin: z.string({ required_error: "Confirm your PIN" }),
    })
    .superRefine(async (values, ctx) => {
        if (values.pin !== values.confirmPin) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPin"], message: "PINs don't match" });
            return;
        }

        const existingPin = await selectTransactionPinByUser({ userId: values.userId });

        if (existingPin) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["pin"],
                message: "A PIN is already set. Change or reset it instead.",
            });
        }
    });

export default postPinSchema;
