import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import isNairaAmount from "@/utils/money/isNairaAmount";
import getWithdrawalQuoteSchema from "@/controllers/withdrawalQuote/get/schema/getWithdrawalQuoteSchema";

// The quote's checks (own active account, amount limits), plus what's confirmed.
const postWithdrawalSchema = getWithdrawalQuoteSchema.and(
    z.object({
        expectedTotal: z
            .string({ required_error: "Confirm the total first" })
            .trim()
            .refine((value) => isNairaAmount({ value }), "Invalid total"),
        idempotencyKey: z
            .string({ required_error: "Idempotency key is required" })
            .uuid("Idempotency key must be a UUID — a new one per withdrawal, reused only to retry the same one"),
        pin: pinSchema,
    }),
);

export default postWithdrawalSchema;
