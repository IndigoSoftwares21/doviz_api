import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import postBankResolutionSchema from "@/controllers/bankResolution/post/schema/postBankResolutionSchema";
import selectActiveBankAccountByNumber from "@/schemaHelpers/selectActiveBankAccountByNumber";

// Same checks as a lookup (legal name, supported bank), plus the PIN and no duplicate.
const postBankAccountSchema = postBankResolutionSchema
    .and(z.object({ pin: pinSchema }))
    .superRefine(async (values, ctx) => {
        if (!z.string().uuid().safeParse(values.bankId).success || !/^\d{10}$/.test(values.accountNumber ?? "")) return;

        const existing = await selectActiveBankAccountByNumber({
            userId: values.userId,
            bankId: values.bankId,
            accountNumber: values.accountNumber,
        });

        if (existing) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["accountNumber"], message: "You've already added this account" });
        }
    });

export default postBankAccountSchema;
