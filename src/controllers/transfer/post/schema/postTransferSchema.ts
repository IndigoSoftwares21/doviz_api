import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import isNairaAmount from "@/utils/money/isNairaAmount";
import transferLimitProblem from "@/utils/transfers/transferLimitProblem";
import fetchTransferLimits from "@/actions/transferLimits/fetchTransferLimits";
import TRANSFERS, { TRANSFER_MESSAGES } from "@/constants/transfers";

// Limits are checked here first (fast, as the amount field's error) and again
// inside the send transaction, under the sender's lock — that one is final.
const postTransferSchema = z
    .object({
        userId: z.string(),
        recipientId: z.string({ required_error: "Choose who to send to" }).uuid("Choose who to send to"),
        amount: z
            .string({ required_error: "Enter an amount" })
            .trim()
            .refine((value) => isNairaAmount({ value }), TRANSFER_MESSAGES.INVALID_AMOUNT),
        note: z
            .string()
            .trim()
            .max(TRANSFERS.NOTE_MAX_LENGTH, `Keep the note to ${TRANSFERS.NOTE_MAX_LENGTH} characters`)
            .optional()
            .transform((value) => value || undefined),
        idempotencyKey: z
            .string({ required_error: "Idempotency key is required" })
            .uuid("Idempotency key must be a UUID — a new one per transfer, reused only to retry the same one"),
        pin: pinSchema,
    })
    .superRefine(async ({ userId, recipientId, amount }, ctx) => {
        if (recipientId === userId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recipientId"], message: "You can't send money to yourself" });
        }
        if (!isNairaAmount({ value: amount })) return;
        const { data: limits } = await fetchTransferLimits({ userId });
        const problem = transferLimitProblem({ amount, limits, sentToday: limits.sentToday });
        if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: problem });
    });

export default postTransferSchema;
