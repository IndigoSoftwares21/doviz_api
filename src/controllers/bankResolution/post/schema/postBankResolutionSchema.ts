import { z } from "zod";
import selectProviderBank from "@/schemaHelpers/selectProviderBank";
import selectUserLegalName from "@/schemaHelpers/selectUserLegalName";

// userId from requireAuth; provider/environment from config.
const postBankResolutionSchema = z
    .object({
        userId: z.string(),
        provider: z.string(),
        environment: z.string(),
        bankId: z.string({ required_error: "Bank is required" }).uuid("Invalid bank"),
        accountNumber: z
            .string({ required_error: "Account number is required" })
            .trim()
            .regex(/^\d{10}$/, "Account number must be 10 digits"),
    })
    .superRefine(async (values, ctx) => {
        const user = await selectUserLegalName({ userId: values.userId });
        if (!user?.firstName || !user.lastName) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bankId"], message: "Add your legal name first" });
            return;
        }

        if (!z.string().uuid().safeParse(values.bankId).success) return;

        const bank = await selectProviderBank({
            bankId: values.bankId,
            provider: values.provider,
            environment: values.environment,
        });
        if (!bank) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bankId"], message: "This bank isn't supported" });
        }
    });

export default postBankResolutionSchema;
