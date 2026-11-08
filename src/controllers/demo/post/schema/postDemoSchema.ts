import { z } from "zod";
import selectDemoByName from "@/schemaHelpers/selectDemoByName";

const postDemoSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Name is required")
            .max(255)
            .regex(
                /^[a-zA-Z0-9\s]+$/,
                "Name may only contain letters, numbers and spaces",
            ),
    })
    .superRefine(async (values, ctx) => {
        const existingDemo = await selectDemoByName({ name: values.name });

        if (existingDemo) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["name"],
                message: "A demo record with this name already exists",
            });
        }
    });

export default postDemoSchema;
