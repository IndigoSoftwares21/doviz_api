import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import isNairaAmount from "@/utils/money/isNairaAmount";
import getCryptoBuyQuoteSchema, { isCryptoAmount } from "@/controllers/cryptoBuyQuote/get/schema/getCryptoBuyQuoteSchema";

// The quote's inputs, plus where to send it and what was confirmed. The
// address is checked per network in the action (it knows the network).
const postCryptoPurchaseSchema = getCryptoBuyQuoteSchema.and(
    z.object({
        address: z.string({ required_error: "Wallet address is required" }).trim().min(10, "Invalid wallet address").max(128, "Invalid wallet address"),
        memo: z.string().trim().max(128, "Memo is too long").optional(),
        expectedTotal: z
            .string({ required_error: "Confirm the total first" })
            .trim()
            .refine((value) => isNairaAmount({ value }), "Invalid total"),
        // The quote's cryptoAmount. Optional for older apps (then the total must match exactly).
        expectedCryptoAmount: z.string().trim().refine(isCryptoAmount, "Invalid amount").optional(),
        idempotencyKey: z
            .string({ required_error: "Idempotency key is required" })
            .uuid("Idempotency key must be a UUID — a new one per purchase, reused only to retry the same one"),
        pin: pinSchema,
    }),
);

export default postCryptoPurchaseSchema;
