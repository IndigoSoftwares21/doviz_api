import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import personNameSchema from "@/utils/validation/personNameSchema";
import optionalPersonNameSchema from "@/utils/validation/optionalPersonNameSchema";
import selectUserNameStatus from "@/schemaHelpers/selectUserNameStatus";

// Setting the name during onboarding is free. Once the user has both a
// name and a PIN, changing the name needs the PIN — renaming an account is
// a classic takeover step. The PIN itself is checked in modifyUserName.
const putUserNameSchema = z
    .object({
        userId: z.string(),
        firstName: personNameSchema({ label: "First name" }),
        middleName: optionalPersonNameSchema({ label: "Middle name" }),
        lastName: personNameSchema({ label: "Last name" }),
        pin: pinSchema.optional(),
    })
    .superRefine(async (values, ctx) => {
        if (values.pin) {
            return;
        }

        const user = await selectUserNameStatus({ userId: values.userId });

        if (user?.firstName && user.hasPin) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["pin"],
                message: "Enter your PIN to change your name",
            });
        }
    });

export default putUserNameSchema;
