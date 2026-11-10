import { z } from "zod";
import selectUserActiveBankAccount from "@/schemaHelpers/selectUserActiveBankAccount";
import withdrawalAmountSchema from "@/utils/validation/withdrawalAmountSchema";

// userId from requireAuth. The account must be the user's own active one.
const getWithdrawalQuoteSchema = z
    .object({
        userId: z.string(),
        bankAccountId: z.string({ required_error: "Bank account is required" }).uuid("Invalid bank account"),
        amount: withdrawalAmountSchema,
    })
    .superRefine(async (values, ctx) => {
        if (!z.string().uuid().safeParse(values.bankAccountId).success) return;
        const account = await selectUserActiveBankAccount({ bankAccountId: values.bankAccountId, userId: values.userId });
        if (!account) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bankAccountId"], message: "Choose one of your bank accounts" });
    });

export default getWithdrawalQuoteSchema;
