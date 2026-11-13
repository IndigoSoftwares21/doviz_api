import { z } from "zod";
import selectUserActiveBankAccount from "@/schemaHelpers/selectUserActiveBankAccount";
import { WithdrawalDestination } from "@/actions/withdrawalQuote/fetchWithdrawalQuote/utils/resolveDestination";

/** Where to send: ONE of the user's saved accounts (bankAccountId), or any account (bankId + accountNumber). */
export const destinationFields = {
    bankAccountId: z.string().uuid("Invalid bank account").optional(),
    bankId: z.string().uuid("Choose a bank").optional(),
    accountNumber: z
        .string()
        .trim()
        .regex(/^\d{10}$/, "Account numbers are 10 digits")
        .optional(),
};

type DestinationValues = { userId: string; bankAccountId?: string; bankId?: string; accountNumber?: string };

/** Exactly one destination; a saved one must be the user's own and active. */
export const checkDestination = async (values: DestinationValues, ctx: z.RefinementCtx) => {
    const other = values.bankId !== undefined || values.accountNumber !== undefined;
    if (values.bankAccountId && other) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bankAccountId"], message: "Choose a saved account OR enter an account, not both" });
        return;
    }
    if (values.bankAccountId) {
        const account = await selectUserActiveBankAccount({ bankAccountId: values.bankAccountId, userId: values.userId });
        if (!account) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bankAccountId"], message: "Choose one of your bank accounts" });
        return;
    }
    if (!values.bankId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bankId"], message: other ? "Choose a bank" : "Choose where to send the money" });
    if (other && !values.accountNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["accountNumber"], message: "Enter the account number" });
};

export const toDestination = (values: DestinationValues): WithdrawalDestination =>
    values.bankAccountId ? { bankAccountId: values.bankAccountId } : { payoutBankId: values.bankId!, accountNumber: values.accountNumber! };
