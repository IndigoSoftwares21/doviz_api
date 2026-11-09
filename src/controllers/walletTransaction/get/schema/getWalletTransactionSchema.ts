import { z } from "zod";
import selectUserStatementEntry from "@/schemaHelpers/selectUserStatementEntry";

// userId comes from requireAuth and is not re-validated here.
const getWalletTransactionSchema = z
    .object({
        userId: z.string(),
        entryId: z.string({ required_error: "Transaction id is required" }).uuid("Invalid transaction id"),
    })
    .superRefine(async (values, ctx) => {
        if (!z.string().uuid().safeParse(values.entryId).success) return;

        // Same answer whether it doesn't exist or belongs to someone else.
        const entry = await selectUserStatementEntry({ userId: values.userId, entryId: values.entryId });
        if (!entry) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["entryId"], message: "Transaction not found" });
        }
    });

export default getWalletTransactionSchema;
