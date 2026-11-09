import { z } from "zod";
import decodeStatementCursor from "@/utils/wallet/decodeStatementCursor";

const toInt = (value: unknown) => (value === undefined || value === "" ? undefined : Number(value));

const getWalletTransactionsSchema = z.object({
    cursor: z
        .string()
        .optional()
        .transform((cursor, ctx) => {
            if (!cursor) return null;
            const entryId = decodeStatementCursor({ cursor });
            if (!entryId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid cursor" });
            return entryId;
        }),
    size: z.preprocess(toInt, z.number().int().min(1).max(50, "Size can be at most 50").default(20)),
});

export default getWalletTransactionsSchema;
